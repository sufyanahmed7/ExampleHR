import Fastify from 'fastify';

const app = Fastify({ logger: true });

// Config from env
const PORT = parseInt(process.env.HCM_MOCK_PORT ?? '3001', 10);
const SILENT_FAILURE_RATE = parseFloat(process.env.HCM_SILENT_FAILURE_RATE ?? '0');
const API_KEY = process.env.HCM_API_KEY ?? 'mock-api-key';

// In-memory balance store
interface Balance {
  employeeId: string;
  locationId: string;
  leaveType: string;
  totalDays: number;
  usedDays: number;
}

interface TimeOffRecord {
  referenceId: string;
  employeeId: string;
  locationId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  status: 'ACTIVE' | 'CANCELLED';
}

const balances: Map<string, Balance> = new Map();
const timeOffRecords: Map<string, TimeOffRecord> = new Map();

function balanceKey(employeeId: string, locationId: string, leaveType: string): string {
  return `${employeeId}::${locationId}::${leaveType}`;
}

// Seed initial balances
function seedBalances(): void {
  const seed = [
    { employeeId: 'emp-001', locationId: 'LOC-001', leaveType: 'ANNUAL', totalDays: 20, usedDays: 3 },
    { employeeId: 'emp-001', locationId: 'LOC-001', leaveType: 'SICK', totalDays: 10, usedDays: 1 },
    { employeeId: 'emp-002', locationId: 'LOC-002', leaveType: 'ANNUAL', totalDays: 15, usedDays: 0 },
  ];
  seed.forEach((b) => balances.set(balanceKey(b.employeeId, b.locationId, b.leaveType), b));
}

seedBalances();

// Simulate work anniversary bonus (random trigger)
function maybeApplyAnniversaryBonus(employeeId: string, locationId: string): void {
  if (Math.random() < 0.05) { // 5% chance
    const key = balanceKey(employeeId, locationId, 'ANNUAL');
    const existing = balances.get(key);
    if (existing) {
      existing.totalDays += 1;
      app.log.info(`🎉 Work anniversary bonus applied for ${employeeId}: +1 ANNUAL day`);
    }
  }
}

// --- Routes ---

// Health check
app.get('/health', async () => ({ status: 'ok', service: 'hcm-mock', timestamp: new Date().toISOString() }));

// GET balance for employee + location
app.get<{ Params: { employeeId: string; locationId: string } }>(
  '/hcm/balance/:employeeId/:locationId',
  async (req, reply) => {
    const { employeeId, locationId } = req.params;

    maybeApplyAnniversaryBonus(employeeId, locationId);

    const result = Array.from(balances.values()).filter(
      (b) => b.employeeId === employeeId && b.locationId === locationId,
    );

    if (result.length === 0) {
      return reply.status(404).send({ message: 'No balances found for this employee/location' });
    }

    return result;
  },
);

// POST submit time off
app.post<{ Body: { employeeId: string; locationId: string; leaveType: string; startDate: string; endDate: string; daysRequested: number; requestId: string } }>(
  '/hcm/timeoff',
  async (req, reply) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) return reply.status(401).send({ message: 'Unauthorized' });

    const { employeeId, locationId, leaveType, daysRequested, requestId } = req.body;

    // Simulate silent failure
    if (Math.random() < SILENT_FAILURE_RATE) {
      app.log.warn(`Silent failure triggered for request ${requestId}`);
      return reply.status(200).send({ referenceId: `silent-${requestId}` });
    }

    const key = balanceKey(employeeId, locationId, leaveType);
    const balance = balances.get(key);

    // HCM validation (may not always be reliable per spec)
    if (balance) {
      const available = balance.totalDays - balance.usedDays;
      if (available < daysRequested) {
        return reply.status(422).send({
          message: `Insufficient balance: ${available} available, ${daysRequested} requested`,
          code: 'INSUFFICIENT_BALANCE',
        });
      }
      balance.usedDays += daysRequested;
    }

    const referenceId = `hcm-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    timeOffRecords.set(referenceId, {
      referenceId,
      employeeId,
      locationId,
      leaveType,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      daysRequested,
      status: 'ACTIVE',
    });

    return reply.status(201).send({ referenceId });
  },
);

// PATCH cancel time off
app.patch<{ Params: { referenceId: string } }>(
  '/hcm/timeoff/:referenceId/cancel',
  async (req, reply) => {
    const { referenceId } = req.params;
    const record = timeOffRecords.get(referenceId);

    if (!record) return reply.status(404).send({ message: 'Record not found' });
    if (record.status === 'CANCELLED') return reply.status(409).send({ message: 'Already cancelled' });

    // Restore balance
    const key = balanceKey(record.employeeId, record.locationId, record.leaveType);
    const balance = balances.get(key);
    if (balance) balance.usedDays = Math.max(0, balance.usedDays - record.daysRequested);

    record.status = 'CANCELLED';
    return reply.status(200).send({ referenceId, status: 'CANCELLED' });
  },
);

// POST batch ingest (HCM receives full corpus from ReadyOn side)
app.post<{ Body: { records: Balance[] } }>(
  '/hcm/batch',
  async (req, reply) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) return reply.status(401).send({ message: 'Unauthorized' });

    const { records } = req.body;
    if (!Array.isArray(records)) return reply.status(400).send({ message: 'records must be an array' });

    for (const r of records) {
      balances.set(balanceKey(r.employeeId, r.locationId, r.leaveType), { ...r });
    }

    return reply.status(200).send({ ingested: records.length, timestamp: new Date().toISOString() });
  },
);

// Admin: view all balances (debug endpoint)
app.get('/hcm/debug/balances', async () => Array.from(balances.values()));

// Admin: trigger anniversary bonus manually (for testing)
app.post<{ Body: { employeeId: string; locationId: string; days?: number } }>(
  '/hcm/debug/anniversary',
  async (req) => {
    const { employeeId, locationId, days = 1 } = req.body;
    const key = balanceKey(employeeId, locationId, 'ANNUAL');
    const balance = balances.get(key);
    if (balance) balance.totalDays += days;
    return { applied: !!balance, employeeId, locationId, bonusDays: days };
  },
);

// Admin: set failure mode (for test control)
app.post<{ Body: { mode: 'normal' | 'error' | 'silent'; rate?: number } }>(
  '/hcm/debug/failure-mode',
  async (req) => {
    process.env.HCM_SILENT_FAILURE_RATE = String(req.body.rate ?? 0);
    return { mode: req.body.mode, rate: req.body.rate ?? 0 };
  },
);

// Start
app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(`🏢 HCM Mock Server running at http://localhost:${PORT}`);
  console.log(`   Silent failure rate: ${SILENT_FAILURE_RATE * 100}%`);
});
