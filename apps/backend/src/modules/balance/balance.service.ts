import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Balance } from '../../database/entities/balance.entity';
import { HcmSyncLog, SyncType, SyncStatus } from '../../database/entities/hcm-sync-log.entity';
import { HcmClientService, HcmBatchRecord } from '../sync/hcm-client.service';

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    @InjectRepository(Balance) private readonly balanceRepo: Repository<Balance>,
    @InjectRepository(HcmSyncLog) private readonly syncLogRepo: Repository<HcmSyncLog>,
    private readonly hcmClient: HcmClientService,
    private readonly dataSource: DataSource,
  ) {}

  async getBalance(employeeId: string, locationId: string): Promise<Balance[]> {
    const balances = await this.balanceRepo.find({ where: { employeeId, locationId } });
    // Fire background HCM sync (non-blocking)
    this.syncFromHcmInBackground(employeeId, locationId).catch((err) =>
      this.logger.warn(`Background HCM sync failed: ${err.message}`),
    );
    return balances;
  }

  async getBalanceForLeaveType(
    employeeId: string,
    locationId: string,
    leaveType: string,
  ): Promise<Balance> {
    const balance = await this.balanceRepo.findOne({
      where: { employeeId, locationId, leaveType },
    });
    if (!balance)
      throw new NotFoundException(`Balance not found for ${employeeId}/${locationId}/${leaveType}`);
    return balance;
  }

  async lockPendingDays(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
  ): Promise<Balance> {
    return this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(Balance, {
        where: { employeeId, locationId, leaveType },
      });

      if (!balance)
        throw new NotFoundException(`No balance for ${leaveType} at ${locationId}`);

      if (balance.availableDays < days)
        throw new BadRequestException(
          `Insufficient balance: ${balance.availableDays} available, ${days} requested`,
        );

      balance.pendingDays += days;
      return manager.save(Balance, balance);
    });
  }

  async releasePendingDays(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(Balance, {
        where: { employeeId, locationId, leaveType },
      });
      if (!balance) return;
      balance.pendingDays = Math.max(0, balance.pendingDays - days);
      await manager.save(Balance, balance);
    });
  }

  async confirmUsedDays(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(Balance, {
        where: { employeeId, locationId, leaveType },
      });
      if (!balance) return;
      balance.pendingDays = Math.max(0, balance.pendingDays - days);
      balance.usedDays += days;
      await manager.save(Balance, balance);
    });
  }

  async ingestBatch(records: HcmBatchRecord[]): Promise<HcmSyncLog> {
    const payloadHash = createHash('sha256').update(JSON.stringify(records)).digest('hex');
    const lastBatch = await this.syncLogRepo.findOne({
      where: { syncType: SyncType.BATCH, status: SyncStatus.SUCCESS },
      order: { createdAt: 'DESC' },
    });
    if (lastBatch?.payloadHash === payloadHash) {
      this.logger.log('Batch payload unchanged — skipping ingest');
      return lastBatch;
    }

    const syncRunId = uuidv4();
    let recordsUpdated = 0;

    await this.dataSource.transaction(async (manager) => {
      for (const record of records) {
        const existing = await manager.findOne(Balance, {
          where: {
            employeeId: record.employeeId,
            locationId: record.locationId,
            leaveType: record.leaveType,
          },
        });

        if (existing) {
          existing.totalDays = record.totalDays;
          existing.usedDays = record.usedDays;
          existing.lastSyncedAt = new Date();
          existing.syncRunId = syncRunId;
          await manager.save(Balance, existing);
        } else {
          const newBalance = manager.create(Balance, {
            ...record,
            lastSyncedAt: new Date(),
            syncRunId,
          });
          await manager.save(Balance, newBalance);
        }
        recordsUpdated++;
      }
    });

    const log = this.syncLogRepo.create({
      syncType: SyncType.BATCH,
      syncRunId,
      status: SyncStatus.SUCCESS,
      recordsProcessed: records.length,
      recordsUpdated,
      payloadHash,
    });
    return this.syncLogRepo.save(log);
  }

  async syncEmployee(employeeId: string, locationId: string): Promise<Balance[]> {
    const hcmBalances = await this.hcmClient.getBalance(employeeId, locationId);
    const syncRunId = uuidv4();

    await this.dataSource.transaction(async (manager) => {
      for (const hcm of hcmBalances) {
        const existing = await manager.findOne(Balance, {
          where: { employeeId, locationId, leaveType: hcm.leaveType },
        });
        if (existing) {
          existing.totalDays = hcm.totalDays;
          existing.usedDays = hcm.usedDays;
          existing.lastSyncedAt = new Date();
          existing.syncRunId = syncRunId;
          await manager.save(Balance, existing);
        } else {
          await manager.save(Balance, manager.create(Balance, {
            employeeId,
            locationId,
            leaveType: hcm.leaveType,
            totalDays: hcm.totalDays,
            usedDays: hcm.usedDays,
            lastSyncedAt: new Date(),
            syncRunId,
          }));
        }
      }
    });

    const log = this.syncLogRepo.create({
      syncType: SyncType.REALTIME,
      syncRunId,
      status: SyncStatus.SUCCESS,
      employeeId,
      recordsProcessed: hcmBalances.length,
      recordsUpdated: hcmBalances.length,
    });
    await this.syncLogRepo.save(log);

    return this.balanceRepo.find({ where: { employeeId, locationId } });
  }

  async reconcile(): Promise<{ discrepancies: number }> {
    const syncRunId = uuidv4();
    let discrepanciesFound = 0;

    try {
      const allBalances = await this.balanceRepo.find();
      const employeeLocations = [
        ...new Map(allBalances.map((b) => [`${b.employeeId}:${b.locationId}`, { employeeId: b.employeeId, locationId: b.locationId }])).values(),
      ];

      for (const { employeeId, locationId } of employeeLocations) {
        try {
          const hcmBalances = await this.hcmClient.getBalance(employeeId, locationId);
          const local = allBalances.filter(
            (b) => b.employeeId === employeeId && b.locationId === locationId,
          );

          for (const hcm of hcmBalances) {
            const loc = local.find((b) => b.leaveType === hcm.leaveType);
            if (!loc) { discrepanciesFound++; continue; }
            if (loc.totalDays !== hcm.totalDays || loc.usedDays !== hcm.usedDays) {
              discrepanciesFound++;
              loc.totalDays = hcm.totalDays;
              loc.usedDays = hcm.usedDays;
              loc.lastSyncedAt = new Date();
              loc.syncRunId = syncRunId;
              await this.balanceRepo.save(loc);
            }
          }
        } catch (err) {
          this.logger.warn(`Reconcile failed for ${employeeId}/${locationId}: ${(err as Error).message}`);
        }
      }

      await this.syncLogRepo.save(
        this.syncLogRepo.create({
          syncType: SyncType.RECONCILE,
          syncRunId,
          status: SyncStatus.SUCCESS,
          recordsProcessed: allBalances.length,
          discrepanciesFound,
        }),
      );

      return { discrepancies: discrepanciesFound };
    } catch (err) {
      await this.syncLogRepo.save(
        this.syncLogRepo.create({
          syncType: SyncType.RECONCILE,
          syncRunId,
          status: SyncStatus.FAILED,
          errorMessage: (err as Error).message,
        }),
      );
      throw err;
    }
  }

  private async syncFromHcmInBackground(employeeId: string, locationId: string): Promise<void> {
    await this.syncEmployee(employeeId, locationId);
  }
}
