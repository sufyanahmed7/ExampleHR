import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HcmSyncLog } from '../../database/entities/hcm-sync-log.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Balance } from '../../database/entities/balance.entity';
import { BalanceService } from '../balance/balance.service';

export interface Discrepancy {
  employeeId: string;
  locationId: string;
  leaveType: string;
  localTotalDays: number;
  localUsedDays: number;
  lastSyncedAt: Date | null;
  staleSinceMs: number;
}

@Injectable()
export class AdminService {
  private readonly STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 min

  constructor(
    @InjectRepository(HcmSyncLog) private readonly syncLogRepo: Repository<HcmSyncLog>,
    @InjectRepository(AuditLog) private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(Balance) private readonly balanceRepo: Repository<Balance>,
    private readonly balanceService: BalanceService,
  ) {}

  async getSyncLogs(limit = 50): Promise<HcmSyncLog[]> {
    return this.syncLogRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getAuditLogs(entityId?: string, limit = 100): Promise<AuditLog[]> {
    const where = entityId ? { entityId } : {};
    return this.auditLogRepo.find({
      where,
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  async getDiscrepancies(): Promise<Discrepancy[]> {
    const now = Date.now();
    const staleBalances = await this.balanceRepo
      .createQueryBuilder('b')
      .where('b.last_synced_at IS NULL OR b.last_synced_at < :threshold', {
        threshold: new Date(now - this.STALE_THRESHOLD_MS).toISOString(),
      })
      .getMany();

    return staleBalances.map((b) => ({
      employeeId: b.employeeId,
      locationId: b.locationId,
      leaveType: b.leaveType,
      localTotalDays: b.totalDays,
      localUsedDays: b.usedDays,
      lastSyncedAt: b.lastSyncedAt,
      staleSinceMs: b.lastSyncedAt ? now - b.lastSyncedAt.getTime() : now,
    }));
  }

  async triggerReconcile(): Promise<{ discrepancies: number; triggeredAt: string }> {
    const result = await this.balanceService.reconcile();
    return { ...result, triggeredAt: new Date().toISOString() };
  }

  async getSyncStats(): Promise<{
    totalSyncs: number;
    successRate: number;
    lastBatchAt: Date | null;
    lastReconcileAt: Date | null;
    staleBalanceCount: number;
  }> {
    const [total, successes, lastBatch, lastReconcile, staleCount] = await Promise.all([
      this.syncLogRepo.count(),
      this.syncLogRepo.count({ where: { status: 'SUCCESS' as any } }),
      this.syncLogRepo.findOne({ where: { syncType: 'BATCH' as any }, order: { createdAt: 'DESC' } }),
      this.syncLogRepo.findOne({ where: { syncType: 'RECONCILE' as any }, order: { createdAt: 'DESC' } }),
      this.balanceRepo.createQueryBuilder('b')
        .where('b.last_synced_at IS NULL OR b.last_synced_at < :threshold', {
          threshold: new Date(Date.now() - this.STALE_THRESHOLD_MS).toISOString(),
        })
        .getCount(),
    ]);

    return {
      totalSyncs: total,
      successRate: total > 0 ? Math.round((successes / total) * 100) : 0,
      lastBatchAt: lastBatch?.createdAt ?? null,
      lastReconcileAt: lastReconcile?.createdAt ?? null,
      staleBalanceCount: staleCount,
    };
  }
}
