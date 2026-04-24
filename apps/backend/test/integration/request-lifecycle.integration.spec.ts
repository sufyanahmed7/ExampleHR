import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { Balance } from '../../../src/database/entities/balance.entity';
import { TimeOffRequest, RequestStatus } from '../../../src/database/entities/time-off-request.entity';
import { HcmSyncLog } from '../../../src/database/entities/hcm-sync-log.entity';
import { AuditLog } from '../../../src/database/entities/audit-log.entity';
import { User, UserRole } from '../../../src/database/entities/user.entity';
import { BalanceModule } from '../../../src/modules/balance/balance.module';
import { RequestModule } from '../../../src/modules/request/request.module';
import { AuthModule } from '../../../src/modules/auth/auth.module';
import { GlobalExceptionFilter } from '../../../src/common/filters/global-exception.filter';

const TEST_DB = ':memory:';
const JWT_SECRET = 'test-secret';

describe('Request Lifecycle Integration', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let employeeToken: string;
  let managerToken: string;
  let adminToken: string;
  let employeeId: string;
  let managerId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({
            port: 3001,
            nodeEnv: 'test',
            jwt: { secret: JWT_SECRET, expiresIn: '1h' },
            database: { path: TEST_DB },
            hcm: { baseUrl: 'http://localhost:3001', apiKey: 'test', timeoutMs: 3000 },
          })],
        }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: TEST_DB,
          entities: [Balance, TimeOffRequest, HcmSyncLog, AuditLog, User],
          synchronize: true,
          dropSchema: true,
        }),
        PassportModule,
        JwtModule.register({ secret: JWT_SECRET }),
        AuthModule,
        BalanceModule,
        RequestModule,
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    dataSource = module.get(DataSource);
    await seedTestData(dataSource);

    // Login to get tokens
    const empLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'emp@test.com', password: 'password' });
    employeeToken = empLogin.body.accessToken;
    employeeId = empLogin.body.user.id;

    const mgrLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'mgr@test.com', password: 'password' });
    managerToken = mgrLogin.body.accessToken;
    managerId = mgrLogin.body.user.id;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'password' });
    adminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication', () => {
    it('POST /auth/login returns JWT for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'emp@test.com', password: 'password' });
      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('POST /auth/login returns 401 for wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'emp@test.com', password: 'wrong' });
      expect(res.status).toBe(401);
    });

    it('GET /auth/me returns profile when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('emp@test.com');
    });

    it('GET /auth/me returns 401 without token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('Balance endpoints', () => {
    it('GET /balances/me returns employee balances', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/balances/me')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].leaveType).toBe('ANNUAL');
    });

    it('GET /balances/:id/:loc returns 403 for employees', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/balances/${employeeId}/LOC-001`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /balances/:id/:loc returns 200 for managers', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/balances/${employeeId}/LOC-001`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('Full request lifecycle', () => {
    let requestId: string;

    it('POST /requests creates PENDING request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ leaveType: 'ANNUAL', startDate: '2099-08-01', endDate: '2099-08-05', daysRequested: 5 });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(RequestStatus.PENDING);
      requestId = res.body.id;
    });

    it('POST /requests blocks same dates — overlap check', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ leaveType: 'ANNUAL', startDate: '2099-08-03', endDate: '2099-08-07', daysRequested: 5 });
      expect(res.status).toBe(400);
    });

    it('GET /requests returns the pending request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(200);
      expect(res.body.some((r: any) => r.id === requestId)).toBe(true);
    });

    it('PATCH /requests/:id/approve transitions to APPROVED', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(RequestStatus.APPROVED);
    });

    it('PATCH /requests/:id/approve returns 400 on already-approved', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(400);
    });

    it('Employee cannot approve their own request', async () => {
      const newReq = await request(app.getHttpServer())
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ leaveType: 'SICK', startDate: '2099-09-01', endDate: '2099-09-01', daysRequested: 1 });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/requests/${newReq.body.id}/approve`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Reject and cancel flows', () => {
    let pendingId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ leaveType: 'SICK', startDate: '2099-10-01', endDate: '2099-10-03', daysRequested: 3 });
      pendingId = res.body.id;
    });

    it('PATCH /requests/:id/reject transitions to REJECTED with reason', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/requests/${pendingId}/reject`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'Busy period' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(RequestStatus.REJECTED);
      expect(res.body.rejectionReason).toBe('Busy period');
    });

    it('DELETE /requests/:id cancels a PENDING request', async () => {
      const newReq = await request(app.getHttpServer())
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ leaveType: 'ANNUAL', startDate: '2099-11-01', endDate: '2099-11-02', daysRequested: 2 });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/requests/${newReq.body.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(RequestStatus.CANCELLED);
    });
  });

  describe('Input validation', () => {
    it('rejects request with missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ leaveType: 'ANNUAL' });
      expect(res.status).toBe(400);
    });

    it('rejects login with invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'password' });
      expect(res.status).toBe(400);
    });

    it('rejects extra fields (whitelist validation)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ leaveType: 'ANNUAL', startDate: '2099-12-01', endDate: '2099-12-05', daysRequested: 5, hackyField: 'evil' });
      expect(res.status).toBe(400);
    });
  });
});

async function seedTestData(ds: DataSource): Promise<void> {
  const hash = await bcrypt.hash('password', 10);
  const userRepo = ds.getRepository(User);
  const balanceRepo = ds.getRepository(Balance);

  const [admin, manager, employee] = await userRepo.save([
    userRepo.create({ email: 'admin@test.com', passwordHash: hash, firstName: 'Admin', lastName: 'User', role: UserRole.ADMIN, locationId: 'LOC-001' }),
    userRepo.create({ email: 'mgr@test.com', passwordHash: hash, firstName: 'Manager', lastName: 'User', role: UserRole.MANAGER, locationId: 'LOC-001' }),
    userRepo.create({ email: 'emp@test.com', passwordHash: hash, firstName: 'Employee', lastName: 'User', role: UserRole.EMPLOYEE, locationId: 'LOC-001' }),
  ]);

  employee.managerId = manager.id;
  await userRepo.save(employee);

  await balanceRepo.save([
    balanceRepo.create({ employeeId: employee.id, locationId: 'LOC-001', leaveType: 'ANNUAL', totalDays: 20, usedDays: 0, pendingDays: 0, lastSyncedAt: new Date() }),
    balanceRepo.create({ employeeId: employee.id, locationId: 'LOC-001', leaveType: 'SICK', totalDays: 10, usedDays: 0, pendingDays: 0, lastSyncedAt: new Date() }),
  ]);
}
