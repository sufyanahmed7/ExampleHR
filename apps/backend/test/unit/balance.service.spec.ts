import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BalanceService } from '../../../src/modules/balance/balance.service';
import { Balance } from '../../../src/database/entities/balance.entity';
import { HcmSyncLog, SyncStatus, SyncType } from '../../../src/database/entities/hcm-sync-log.entity';
import { HcmClientService } from '../../../src/modules/sync/hcm-client.service';

const mockBalanceRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockSyncLogRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((data: any) => data),
});

const mockHcmClient = () => ({
  getBalance: jest.fn(),
  submitTimeOff: jest.fn(),
  cancelTimeOff: jest.fn(),
  ingestBatch: jest.fn(),
});

const mockDataSource = () => ({
  transaction: jest.fn(),
  getRepository: jest.fn(),
});

describe('BalanceService', () => {
  let service: BalanceService;
  let balanceRepo: ReturnType<typeof mockBalanceRepo>;
  let syncLogRepo: ReturnType<typeof mockSyncLogRepo>;
  let hcmClient: ReturnType<typeof mockHcmClient>;
  let dataSource: ReturnType<typeof mockDataSource>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        { provide: getRepositoryToken(Balance), useFactory: mockBalanceRepo },
        { provide: getRepositoryToken(HcmSyncLog), useFactory: mockSyncLogRepo },
        { provide: HcmClientService, useFactory: mockHcmClient },
        { provide: DataSource, useFactory: mockDataSource },
      ],
    }).compile();

    service = module.get(BalanceService);
    balanceRepo = module.get(getRepositoryToken(Balance));
    syncLogRepo = module.get(getRepositoryToken(HcmSyncLog));
    hcmClient = module.get(HcmClientService);
    dataSource = module.get(DataSource);
  });

  describe('getBalance', () => {
    it('returns balances from local repo', async () => {
      const mockBalances = [{ id: '1', employeeId: 'emp1', locationId: 'loc1', leaveType: 'ANNUAL', totalDays: 20, usedDays: 3, pendingDays: 0 }];
      balanceRepo.find.mockResolvedValue(mockBalances);
      jest.spyOn(service as any, 'syncFromHcmInBackground').mockResolvedValue(undefined);

      const result = await service.getBalance('emp1', 'loc1');
      expect(result).toEqual(mockBalances);
      expect(balanceRepo.find).toHaveBeenCalledWith({ where: { employeeId: 'emp1', locationId: 'loc1' } });
    });

    it('fires background sync without blocking', async () => {
      balanceRepo.find.mockResolvedValue([]);
      const syncSpy = jest.spyOn(service as any, 'syncFromHcmInBackground').mockResolvedValue(undefined);

      await service.getBalance('emp1', 'loc1');
      expect(syncSpy).toHaveBeenCalledWith('emp1', 'loc1');
    });
  });

  describe('lockPendingDays', () => {
    it('increments pendingDays when sufficient balance', async () => {
      const balance = { employeeId: 'emp1', locationId: 'loc1', leaveType: 'ANNUAL', totalDays: 20, usedDays: 3, pendingDays: 0, get availableDays() { return this.totalDays - this.usedDays - this.pendingDays; } };
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(balance),
        save: jest.fn().mockImplementation((_, b) => Promise.resolve(b)),
      };
      dataSource.transaction.mockImplementation((cb: any) => cb(managerMock));

      const result = await service.lockPendingDays('emp1', 'loc1', 'ANNUAL', 5);
      expect(result.pendingDays).toBe(5);
      expect(managerMock.save).toHaveBeenCalled();
    });

    it('throws BadRequestException when insufficient balance', async () => {
      const balance = { employeeId: 'emp1', locationId: 'loc1', leaveType: 'ANNUAL', totalDays: 5, usedDays: 3, pendingDays: 2, get availableDays() { return 0; } };
      const managerMock = { findOne: jest.fn().mockResolvedValue(balance), save: jest.fn() };
      dataSource.transaction.mockImplementation((cb: any) => cb(managerMock));

      await expect(service.lockPendingDays('emp1', 'loc1', 'ANNUAL', 3))
        .rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when balance record does not exist', async () => {
      const managerMock = { findOne: jest.fn().mockResolvedValue(null), save: jest.fn() };
      dataSource.transaction.mockImplementation((cb: any) => cb(managerMock));

      await expect(service.lockPendingDays('emp1', 'loc1', 'SICK', 1))
        .rejects.toThrow(NotFoundException);
    });

    it('does not allow locking 0 days (edge: exactly 0 available)', async () => {
      const balance = { totalDays: 5, usedDays: 5, pendingDays: 0, get availableDays() { return 0; } };
      const managerMock = { findOne: jest.fn().mockResolvedValue(balance), save: jest.fn() };
      dataSource.transaction.mockImplementation((cb: any) => cb(managerMock));

      await expect(service.lockPendingDays('emp1', 'loc1', 'ANNUAL', 1))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('releasePendingDays', () => {
    it('decrements pendingDays correctly', async () => {
      const balance = { pendingDays: 5 };
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(balance),
        save: jest.fn().mockImplementation((_, b) => Promise.resolve(b)),
      };
      dataSource.transaction.mockImplementation((cb: any) => cb(managerMock));

      await service.releasePendingDays('emp1', 'loc1', 'ANNUAL', 3);
      expect(balance.pendingDays).toBe(2);
    });

    it('floors pendingDays at 0 (never negative)', async () => {
      const balance = { pendingDays: 1 };
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(balance),
        save: jest.fn().mockImplementation((_, b) => Promise.resolve(b)),
      };
      dataSource.transaction.mockImplementation((cb: any) => cb(managerMock));

      await service.releasePendingDays('emp1', 'loc1', 'ANNUAL', 10);
      expect(balance.pendingDays).toBe(0);
    });

    it('does nothing if balance record is missing', async () => {
      const managerMock = { findOne: jest.fn().mockResolvedValue(null), save: jest.fn() };
      dataSource.transaction.mockImplementation((cb: any) => cb(managerMock));

      await expect(service.releasePendingDays('emp1', 'loc1', 'ANNUAL', 5)).resolves.not.toThrow();
      expect(managerMock.save).not.toHaveBeenCalled();
    });
  });

  describe('confirmUsedDays', () => {
    it('decrements pendingDays and increments usedDays atomically', async () => {
      const balance = { pendingDays: 5, usedDays: 2 };
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(balance),
        save: jest.fn().mockImplementation((_, b) => Promise.resolve(b)),
      };
      dataSource.transaction.mockImplementation((cb: any) => cb(managerMock));

      await service.confirmUsedDays('emp1', 'loc1', 'ANNUAL', 5);
      expect(balance.pendingDays).toBe(0);
      expect(balance.usedDays).toBe(7);
    });
  });

  describe('ingestBatch', () => {
    it('skips re-ingest when payload hash matches last batch', async () => {
      const records = [{ employeeId: 'emp1', locationId: 'loc1', leaveType: 'ANNUAL', totalDays: 20, usedDays: 0 }];
      const { createHash } = require('crypto');
      const hash = createHash('sha256').update(JSON.stringify(records)).digest('hex');

      syncLogRepo.findOne.mockResolvedValue({ payloadHash: hash, status: SyncStatus.SUCCESS });

      const result = await service.ingestBatch(records);
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(result.payloadHash).toBe(hash);
    });

    it('processes new batch when hash differs', async () => {
      const records = [{ employeeId: 'emp1', locationId: 'loc1', leaveType: 'ANNUAL', totalDays: 25, usedDays: 5 }];
      syncLogRepo.findOne.mockResolvedValue({ payloadHash: 'different-hash', status: SyncStatus.SUCCESS });
      syncLogRepo.save.mockImplementation((log: any) => Promise.resolve({ ...log, id: 'log1' }));

      const managerMock = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((_: any, data: any) => data),
        save: jest.fn().mockImplementation((_: any, data: any) => Promise.resolve(data)),
      };
      dataSource.transaction.mockImplementation((cb: any) => cb(managerMock));

      const result = await service.ingestBatch(records);
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result.status).toBe(SyncStatus.SUCCESS);
    });

    it('updates existing balance on batch ingest', async () => {
      const records = [{ employeeId: 'emp1', locationId: 'loc1', leaveType: 'ANNUAL', totalDays: 30, usedDays: 10 }];
      syncLogRepo.findOne.mockResolvedValue(null);
      syncLogRepo.save.mockImplementation((log: any) => Promise.resolve({ ...log, id: 'log1' }));

      const existingBalance = { employeeId: 'emp1', locationId: 'loc1', leaveType: 'ANNUAL', totalDays: 20, usedDays: 5, lastSyncedAt: null, syncRunId: null };
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(existingBalance),
        save: jest.fn().mockImplementation((_: any, data: any) => Promise.resolve(data)),
        create: jest.fn(),
      };
      dataSource.transaction.mockImplementation((cb: any) => cb(managerMock));

      await service.ingestBatch(records);
      expect(existingBalance.totalDays).toBe(30);
      expect(existingBalance.usedDays).toBe(10);
    });
  });

  describe('availableDays computed property', () => {
    it('returns totalDays - usedDays - pendingDays', () => {
      const b = new Balance();
      b.totalDays = 20;
      b.usedDays = 5;
      b.pendingDays = 3;
      expect(b.availableDays).toBe(12);
    });

    it('never returns negative', () => {
      const b = new Balance();
      b.totalDays = 5;
      b.usedDays = 5;
      b.pendingDays = 2;
      expect(b.availableDays).toBe(0);
    });
  });
});
