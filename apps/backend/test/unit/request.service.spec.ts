import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestService } from '../../../src/modules/request/request.service';
import { TimeOffRequest, RequestStatus } from '../../../src/database/entities/time-off-request.entity';
import { AuditLog } from '../../../src/database/entities/audit-log.entity';
import { User, UserRole } from '../../../src/database/entities/user.entity';
import { BalanceService } from '../../../src/modules/balance/balance.service';
import { HcmClientService } from '../../../src/modules/sync/hcm-client.service';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({ id: 'user-1', email: 'e@test.com', role: UserRole.EMPLOYEE, locationId: 'LOC-001', ...overrides } as User);

const makeManager = (): User =>
  makeUser({ id: 'mgr-1', role: UserRole.MANAGER });

const makeRequest = (overrides: Partial<TimeOffRequest> = {}): TimeOffRequest => ({
  id: 'req-1',
  employeeId: 'user-1',
  locationId: 'LOC-001',
  leaveType: 'ANNUAL',
  startDate: '2099-07-01',
  endDate: '2099-07-05',
  daysRequested: 5,
  status: RequestStatus.PENDING,
  managerId: null,
  notes: null,
  rejectionReason: null,
  submittedAt: new Date(),
  resolvedAt: null,
  hcmReferenceId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
} as TimeOffRequest);

describe('RequestService', () => {
  let service: RequestService;
  let requestRepo: any;
  let auditRepo: any;
  let userRepo: any;
  let balanceService: any;
  let hcmClient: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestService,
        {
          provide: getRepositoryToken(TimeOffRequest),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: { create: jest.fn((d: any) => d), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: BalanceService,
          useValue: {
            lockPendingDays: jest.fn().mockResolvedValue({}),
            releasePendingDays: jest.fn().mockResolvedValue(undefined),
            confirmUsedDays: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: HcmClientService,
          useValue: {
            submitTimeOff: jest.fn().mockResolvedValue({ referenceId: 'hcm-ref-1' }),
            cancelTimeOff: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(RequestService);
    requestRepo = module.get(getRepositoryToken(TimeOffRequest));
    auditRepo = module.get(getRepositoryToken(AuditLog));
    userRepo = module.get(getRepositoryToken(User));
    balanceService = module.get(BalanceService);
    hcmClient = module.get(HcmClientService);
  });

  describe('create', () => {
    const dto = {
      leaveType: 'ANNUAL',
      startDate: '2099-07-01',
      endDate: '2099-07-05',
      daysRequested: 5,
    };

    beforeEach(() => {
      const qb: any = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getCount: jest.fn().mockResolvedValue(0) };
      requestRepo.createQueryBuilder.mockReturnValue(qb);
      requestRepo.create.mockImplementation((d: any) => d);
      requestRepo.save.mockImplementation((d: any) => Promise.resolve({ ...d, id: 'req-1' }));
    });

    it('creates a PENDING request and locks balance', async () => {
      const user = makeUser();
      const result = await service.create(dto, user);
      expect(balanceService.lockPendingDays).toHaveBeenCalledWith('user-1', 'LOC-001', 'ANNUAL', 5);
      expect(result.status).toBe(RequestStatus.PENDING);
      expect(auditRepo.save).toHaveBeenCalled();
    });

    it('rejects past start dates', async () => {
      const user = makeUser();
      await expect(service.create({ ...dto, startDate: '2000-01-01', endDate: '2000-01-05' }, user))
        .rejects.toThrow(BadRequestException);
      expect(balanceService.lockPendingDays).not.toHaveBeenCalled();
    });

    it('rejects end date before start date', async () => {
      const user = makeUser();
      await expect(service.create({ ...dto, startDate: '2099-07-10', endDate: '2099-07-05' }, user))
        .rejects.toThrow(BadRequestException);
    });

    it('rejects overlapping pending request', async () => {
      const qb: any = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getCount: jest.fn().mockResolvedValue(1) };
      requestRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.create(dto, makeUser())).rejects.toThrow();
      expect(balanceService.lockPendingDays).not.toHaveBeenCalled();
    });

    it('does not create request when balance lock fails', async () => {
      balanceService.lockPendingDays.mockRejectedValue(new BadRequestException('Insufficient balance'));

      await expect(service.create(dto, makeUser())).rejects.toThrow(BadRequestException);
      expect(requestRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('transitions PENDING → APPROVED and calls HCM', async () => {
      const req = makeRequest();
      requestRepo.findOne.mockResolvedValue(req);
      requestRepo.save.mockImplementation((d: any) => Promise.resolve(d));

      const result = await service.approve('req-1', makeManager());
      expect(result.status).toBe(RequestStatus.APPROVED);
      expect(hcmClient.submitTimeOff).toHaveBeenCalled();
      expect(balanceService.confirmUsedDays).toHaveBeenCalledWith('user-1', 'LOC-001', 'ANNUAL', 5);
      expect(result.hcmReferenceId).toBe('hcm-ref-1');
    });

    it('throws ForbiddenException when employee tries to approve', async () => {
      await expect(service.approve('req-1', makeUser())).rejects.toThrow(ForbiddenException);
      expect(requestRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when approving non-PENDING request', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest({ status: RequestStatus.APPROVED }));
      await expect(service.approve('req-1', makeManager())).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when HCM rejects the submission', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest());
      hcmClient.submitTimeOff.mockRejectedValue(new Error('Insufficient HCM balance'));

      await expect(service.approve('req-1', makeManager())).rejects.toThrow(BadRequestException);
      expect(balanceService.confirmUsedDays).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for non-existent request', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      await expect(service.approve('missing', makeManager())).rejects.toThrow(NotFoundException);
    });
  });

  describe('reject', () => {
    it('transitions PENDING → REJECTED and releases balance', async () => {
      const req = makeRequest();
      requestRepo.findOne.mockResolvedValue(req);
      requestRepo.save.mockImplementation((d: any) => Promise.resolve(d));

      const result = await service.reject('req-1', 'Conflict with project deadline', makeManager());
      expect(result.status).toBe(RequestStatus.REJECTED);
      expect(result.rejectionReason).toBe('Conflict with project deadline');
      expect(balanceService.releasePendingDays).toHaveBeenCalledWith('user-1', 'LOC-001', 'ANNUAL', 5);
    });

    it('throws ForbiddenException when employee tries to reject', async () => {
      await expect(service.reject('req-1', 'reason', makeUser())).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException on already-resolved request', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest({ status: RequestStatus.REJECTED }));
      await expect(service.reject('req-1', 'again', makeManager())).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('transitions PENDING → CANCELLED and releases balance', async () => {
      const req = makeRequest();
      requestRepo.findOne.mockResolvedValue(req);
      requestRepo.save.mockImplementation((d: any) => Promise.resolve(d));

      const result = await service.cancel('req-1', makeUser());
      expect(result.status).toBe(RequestStatus.CANCELLED);
      expect(balanceService.releasePendingDays).toHaveBeenCalledWith('user-1', 'LOC-001', 'ANNUAL', 5);
    });

    it('also cancels in HCM when hcmReferenceId exists', async () => {
      const req = makeRequest({ hcmReferenceId: 'hcm-ref-1' });
      requestRepo.findOne.mockResolvedValue(req);
      requestRepo.save.mockImplementation((d: any) => Promise.resolve(d));

      await service.cancel('req-1', makeUser());
      expect(hcmClient.cancelTimeOff).toHaveBeenCalledWith('hcm-ref-1');
    });

    it('throws ForbiddenException when employee cancels another employee\'s request', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest({ employeeId: 'other-user' }));
      await expect(service.cancel('req-1', makeUser())).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when cancelling APPROVED request', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest({ status: RequestStatus.APPROVED }));
      await expect(service.cancel('req-1', makeUser())).rejects.toThrow(BadRequestException);
    });
  });
});
