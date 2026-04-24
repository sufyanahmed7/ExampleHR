import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as http from 'http';
import { DataSource } from 'typeorm';
import { Balance } from '../../../src/database/entities/balance.entity';
import { TimeOffRequest } from '../../../src/database/entities/time-off-request.entity';
import { HcmSyncLog } from '../../../src/database/entities/hcm-sync-log.entity';
import { AuditLog } from '../../../src/database/entities/audit-log.entity';
import { User, UserRole } from '../../../src/database/entities/user.entity';
import { AuthModule } from '../../../src/modules/auth/auth.module';
import { BalanceModule } from '../../../src/modules/balance/balance.module';
import { RequestModule } from '../../../src/modules/request/request.module';
import { AdminModule } from '../../../src/modules/admin/admin.module';
import { GlobalExceptionFilter } from '../../../src/common/filters/global-exception.filter';

const HCM_PORT = 3099;
let hcmServer: http.Server;
let hcmMode: 'normal' | 'error' | 'silent' | 'timeout' = 'normal';

function createHcmMockServer(): http.Server {
  return http.createServer((req, res) => {
    const url = req.url ?? '';

    if (req.method === 'GET' && url.match(/\/hcm\/balance\/.+\/.+/)) {
      if (hcmMode === 'timeout') {
        // Don't respond — simulate timeout
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([
        { employeeId: 'emp1', locationId: 'LOC-001', leaveType: 'ANNUAL', totalDays: 20, usedDays: 3 },
      ]));
      return;
    }

    if (req.method === 'POST' && url === '/hcm/timeoff') {
      if (hcmMode === 'error') {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Insufficient balance in HCM' }));
        return;
      }
      if (hcmMode === 'silent') {
        // Silent failure: returns 200 but does nothing meaningful
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ referenceId: 'silent-ref' }));
        return;
      }
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ referenceId: `hcm-${Date.now()}` }));
      return;
    }

    if (req.method === 'POST' && url === '/hcm/batch') {
      res.writeHead(200);
      res.end();
      return;
    }

    res.writeHead(404);
    res.end();
  });
}

describe('HCM Contract E2E Tests', () => {
  let app: INestApplication;
  let ds: DataSource;
  let employeeToken: string;
  let managerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Start mock HCM server
    hcmServer = createHcmMockServer();
    await new Promise<void>((resolve) => hcmServer.listen(HCM_PORT, resolve));

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({
            port: 3002,
            nodeEnv: 'test',
            jwt: { secret: 'e2e-secret', expiresIn: '1h' },
            database: { path: ':memory:' },
            hcm: { baseUrl: `http://localhost:${HCM_PORT}`, apiKey: 'test', timeoutMs: 1000 },
          })],
        }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Balance, TimeOffRequest, HcmSyncLog, AuditLog, User],
          synchronize: true,
          dropSchema: true,
        }),
        AuthModule,
        BalanceModule,
        RequestModule,
        AdminModule,
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    ds = module.get(DataSource);
    await seedE2EData(ds);

    const empRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login').send({ email: 'e2e-emp@test.com', password: 'password' });
    employeeToken = empRes.body.accessToken;

    const mgrRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login').send({ email: 'e2e-mgr@test.com', password: 'password' });
    managerToken = mgrRes.body.accessToken;

    const admRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login').send({ email: 'e2e-admin@test.com', password: 'password' });
    adminToken = admRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await new Promise<void>((resolve) => hcmServer.close(() => resolve()));
  });

  beforeEach(() => {
    hcmMode = 'normal';
  });

  describe('HCM integration — normal flow', () => {
    it('approval succeeds and stores HCM reference ID', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ leaveType: 'ANNUAL', startDate: '2099-07-01', endDate: '2099-07-03', daysRequested: 3 });
      expect(createRes.status).toBe(201);

      const approveRes = await request(app.getHttpServer())
        .patch(`/api/v1/requests/${createRes.body.id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.hcmReferenceId).toMatch(/^hcm-/);
    });
  });

  describe('HCM integration — error handling', () => {
    it('returns 400 when HCM explicitly rejects the request', async () => {
      hcmMode = 'error';

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ leaveType: 'ANNUAL', startDate: '2099-08-01', endDate: '2099-08-02', daysRequested: 2 });

      const approveRes = await request(app.getHttpServer())
        .patch(`/api/v1/requests/${createRes.body.id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(approveRes.status).toBe(400);
      expect(approveRes.body.message).toContain('HCM');

      // Balance should remain pending (not consumed)
      const balanceRes = await request(app.getHttpServer())
        .get('/api/v1/balances/me')
        .set('Authorization', `Bearer ${employeeToken}`);
      const annual = balanceRes.body.find((b: any) => b.leaveType === 'ANNUAL');
      expect(annual.pendingDays).toBeGreaterThan(0); // still pending
    });

    it('defensive: local validation catches insufficient balance before HCM', async () => {
      // Request more than available
      const res = await request(app.getHttpServer())
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ leaveType: 'ANNUAL', startDate: '2099-12-01', endDate: '2099-12-31', daysRequested: 999 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Insufficient');
    });
  });

  describe('Batch ingest', () => {
    it('POST /balances/sync/batch succeeds for admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/balances/sync/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          records: [
            { employeeId: 'any-emp', locationId: 'LOC-001', leaveType: 'ANNUAL', totalDays: 25, usedDays: 5 },
          ],
        });
      expect(res.status).toBe(200);
    });

    it('POST /balances/sync/batch returns 403 for employees', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/balances/sync/batch')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ records: [] });
      expect(res.status).toBe(403);
    });

    it('skips duplicate batch payload (idempotency)', async () => {
      const records = [{ employeeId: 'dedup-emp', locationId: 'LOC-001', leaveType: 'SICK', totalDays: 10, usedDays: 2 }];
      await request(app.getHttpServer())
        .post('/api/v1/balances/sync/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ records });

      const res2 = await request(app.getHttpServer())
        .post('/api/v1/balances/sync/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ records });
      expect(res2.status).toBe(200);
    });
  });

  describe('Admin sync and reconcile', () => {
    it('GET /admin/stats returns sync statistics', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.totalSyncs).toBe('number');
      expect(typeof res.body.successRate).toBe('number');
    });

    it('POST /admin/reconcile triggers reconciliation', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/reconcile')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.triggeredAt).toBeDefined();
    });

    it('GET /admin/sync-logs returns list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/sync-logs')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /admin/stats returns 403 for employee', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(403);
    });
  });
});

async function seedE2EData(ds: DataSource): Promise<void> {
  const hash = await bcrypt.hash('password', 10);
  const userRepo = ds.getRepository(User);
  const balanceRepo = ds.getRepository(Balance);

  const [admin, manager, employee] = await userRepo.save([
    userRepo.create({ email: 'e2e-admin@test.com', passwordHash: hash, firstName: 'Admin', lastName: 'E2E', role: UserRole.ADMIN, locationId: 'LOC-001' }),
    userRepo.create({ email: 'e2e-mgr@test.com', passwordHash: hash, firstName: 'Manager', lastName: 'E2E', role: UserRole.MANAGER, locationId: 'LOC-001' }),
    userRepo.create({ email: 'e2e-emp@test.com', passwordHash: hash, firstName: 'Employee', lastName: 'E2E', role: UserRole.EMPLOYEE, locationId: 'LOC-001' }),
  ]);

  employee.managerId = manager.id;
  await userRepo.save(employee);

  await balanceRepo.save([
    balanceRepo.create({ employeeId: employee.id, locationId: 'LOC-001', leaveType: 'ANNUAL', totalDays: 20, usedDays: 0, pendingDays: 0, lastSyncedAt: new Date() }),
    balanceRepo.create({ employeeId: employee.id, locationId: 'LOC-001', leaveType: 'SICK', totalDays: 10, usedDays: 0, pendingDays: 0, lastSyncedAt: new Date() }),
  ]);
}
