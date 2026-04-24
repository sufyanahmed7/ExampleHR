import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
  ConflictException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeOffRequest, RequestStatus } from '../../database/entities/time-off-request.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { User, UserRole } from '../../database/entities/user.entity';
import { BalanceService } from '../balance/balance.service';
import { HcmClientService } from '../sync/hcm-client.service';
import { CreateRequestDto, ListRequestsDto } from './dto/request.dto';

@Injectable()
export class RequestService {
  private readonly logger = new Logger(RequestService.name);

  constructor(
    @InjectRepository(TimeOffRequest)
    private readonly requestRepo: Repository<TimeOffRequest>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly balanceService: BalanceService,
    private readonly hcmClient: HcmClientService,
  ) {}

  async create(dto: CreateRequestDto, actor: User): Promise<TimeOffRequest> {
    this.validateDateRange(dto.startDate, dto.endDate);

    await this.checkDateOverlap(actor.id, dto.startDate, dto.endDate);

    // Defensive pre-validation: check local balance first
    await this.balanceService.lockPendingDays(
      actor.id,
      actor.locationId,
      dto.leaveType,
      dto.daysRequested,
    );

    const request = this.requestRepo.create({
      employeeId: actor.id,
      locationId: actor.locationId,
      leaveType: dto.leaveType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      daysRequested: dto.daysRequested,
      notes: dto.notes,
      status: RequestStatus.PENDING,
      submittedAt: new Date(),
    });

    const saved = await this.requestRepo.save(request);
    await this.audit(saved.id, 'REQUEST_CREATED', actor, null, saved);
    return saved;
  }

  async list(dto: ListRequestsDto, actor: User): Promise<TimeOffRequest[]> {
    const qb = this.requestRepo.createQueryBuilder('r');

    if (actor.role === UserRole.EMPLOYEE) {
      qb.where('r.employee_id = :id', { id: actor.id });
    } else if (actor.role === UserRole.MANAGER) {
      const reports = await this.userRepo.find({ where: { managerId: actor.id } });
      const reportIds = reports.map((u) => u.id);
      qb.where('r.employee_id IN (:...ids)', { ids: [actor.id, ...reportIds] });
    }

    if (dto.employeeId && actor.role !== UserRole.EMPLOYEE)
      qb.andWhere('r.employee_id = :empId', { empId: dto.employeeId });
    if (dto.status) qb.andWhere('r.status = :status', { status: dto.status });
    if (dto.fromDate) qb.andWhere('r.start_date >= :from', { from: dto.fromDate });
    if (dto.toDate) qb.andWhere('r.end_date <= :to', { to: dto.toDate });

    return qb.orderBy('r.submitted_at', 'DESC').getMany();
  }

  async findOne(id: string, actor: User): Promise<TimeOffRequest> {
    const req = await this.requestRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    this.assertCanRead(req, actor);
    return req;
  }

  async approve(id: string, actor: User): Promise<TimeOffRequest> {
    if (actor.role !== UserRole.MANAGER && actor.role !== UserRole.ADMIN)
      throw new ForbiddenException('Only managers can approve requests');

    const req = await this.requestRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== RequestStatus.PENDING)
      throw new BadRequestException(`Cannot approve a ${req.status} request`);

    const before = { ...req };

    // Notify HCM
    try {
      const hcmResult = await this.hcmClient.submitTimeOff({
        employeeId: req.employeeId,
        locationId: req.locationId,
        leaveType: req.leaveType,
        startDate: req.startDate,
        endDate: req.endDate,
        daysRequested: req.daysRequested,
        requestId: req.id,
      });
      req.hcmReferenceId = hcmResult.referenceId;
    } catch (err) {
      this.logger.error(`HCM submission failed for request ${id}: ${(err as Error).message}`);
      throw new BadRequestException(`HCM rejected request: ${(err as Error).message}`);
    }

    req.status = RequestStatus.APPROVED;
    req.managerId = actor.id;
    req.resolvedAt = new Date();

    await this.balanceService.confirmUsedDays(
      req.employeeId, req.locationId, req.leaveType, req.daysRequested,
    );

    const saved = await this.requestRepo.save(req);
    await this.audit(saved.id, 'REQUEST_APPROVED', actor, before, saved);
    return saved;
  }

  async reject(id: string, reason: string, actor: User): Promise<TimeOffRequest> {
    if (actor.role !== UserRole.MANAGER && actor.role !== UserRole.ADMIN)
      throw new ForbiddenException('Only managers can reject requests');

    const req = await this.requestRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== RequestStatus.PENDING)
      throw new BadRequestException(`Cannot reject a ${req.status} request`);

    const before = { ...req };
    req.status = RequestStatus.REJECTED;
    req.managerId = actor.id;
    req.rejectionReason = reason;
    req.resolvedAt = new Date();

    await this.balanceService.releasePendingDays(
      req.employeeId, req.locationId, req.leaveType, req.daysRequested,
    );

    const saved = await this.requestRepo.save(req);
    await this.audit(saved.id, 'REQUEST_REJECTED', actor, before, saved);
    return saved;
  }

  async cancel(id: string, actor: User): Promise<TimeOffRequest> {
    const req = await this.requestRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.employeeId !== actor.id && actor.role !== UserRole.ADMIN)
      throw new ForbiddenException('Cannot cancel another employee\'s request');
    if (req.status !== RequestStatus.PENDING)
      throw new BadRequestException('Only PENDING requests can be cancelled');

    const before = { ...req };
    req.status = RequestStatus.CANCELLED;
    req.resolvedAt = new Date();

    await this.balanceService.releasePendingDays(
      req.employeeId, req.locationId, req.leaveType, req.daysRequested,
    );

    if (req.hcmReferenceId) {
      await this.hcmClient.cancelTimeOff(req.hcmReferenceId).catch((err) =>
        this.logger.warn(`HCM cancel failed: ${(err as Error).message}`),
      );
    }

    const saved = await this.requestRepo.save(req);
    await this.audit(saved.id, 'REQUEST_CANCELLED', actor, before, saved);
    return saved;
  }

  private validateDateRange(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()))
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    if (start > end)
      throw new BadRequestException('Start date must be before or equal to end date');
    if (start < new Date(new Date().toDateString()))
      throw new BadRequestException('Cannot request time off in the past');
  }

  private async checkDateOverlap(employeeId: string, startDate: string, endDate: string): Promise<void> {
    const overlapping = await this.requestRepo
      .createQueryBuilder('r')
      .where('r.employee_id = :employeeId', { employeeId })
      .andWhere('r.status IN (:...statuses)', {
        statuses: [RequestStatus.PENDING, RequestStatus.APPROVED],
      })
      .andWhere('r.start_date <= :endDate AND r.end_date >= :startDate', { startDate, endDate })
      .getCount();

    if (overlapping > 0)
      throw new ConflictException('Date range overlaps with an existing pending or approved request');
  }

  private assertCanRead(req: TimeOffRequest, actor: User): void {
    if (actor.role === UserRole.ADMIN) return;
    if (actor.role === UserRole.MANAGER) return;
    if (req.employeeId !== actor.id) throw new ForbiddenException('Access denied');
  }

  private async audit(
    entityId: string, action: string, actor: User,
    before: any, after: any,
  ): Promise<void> {
    const log = this.auditRepo.create({
      entityType: 'TimeOffRequest',
      entityId,
      action,
      actorId: actor.id,
      actorRole: actor.role,
      beforeState: before ? JSON.stringify(before) : null,
      afterState: after ? JSON.stringify(after) : null,
    });
    await this.auditRepo.save(log).catch((err) =>
      this.logger.warn(`Audit log failed: ${err.message}`),
    );
  }
}


