# ExampleHR Time-Off Management System

A full-stack time-off management microservice built with **NestJS + SQLite** backend, **Fastify HCM mock server**, and a **React + Vite + Tailwind v4** frontend.

---

## Architecture

```
timeoff-system/
├── apps/
│   ├── backend/      NestJS microservice (port 3000)
│   ├── hcm-mock/     Fastify HCM mock server (port 3001)
│   └── frontend/     React + Vite SPA (port 5173)
```

### Backend modules

| Module | Responsibility |
|---|---|
| `AuthModule` | JWT login, `/auth/me`, RBAC guards |
| `BalanceModule` | Dual-write balance cache, pending lock, batch ingest, reconcile |
| `RequestModule` | FSM lifecycle: PENDING → APPROVED / REJECTED / CANCELLED |
| `AdminModule` | Sync stats, discrepancies, audit log, manual reconcile |
| `SyncModule` | HCM HTTP client, 30-min reconcile cron |

---

## Quick Start

### Prerequisites
- Node.js 20+
- npm 9+

### Install

```bash
git clone <your-repo>
cd timeoff-system
npm install
cp .env.example .env
```

### Run all three services

```bash
npm run dev
```

This starts:
- Backend → http://localhost:3000
- HCM Mock → http://localhost:3001
- Frontend → http://localhost:5173

### Individual services

```bash
npm run dev:backend    # NestJS only
npm run dev:mock       # HCM mock only
npm run dev:frontend   # React only
```
---

## API Reference

Swagger UI → http://localhost:3000/api/docs (development only)

### Base URL: `/api/v1`

#### Auth
```
POST /auth/login          Login, receive JWT
GET  /auth/me             Get current user profile
```

#### Balances
```
GET  /balances/me                            My balances (+ background HCM sync)
GET  /balances/:employeeId/:locationId       Manager/Admin: specific employee
POST /balances/sync/batch                    Admin: ingest full HCM corpus
POST /balances/sync/employee/:id/:loc        Manager/Admin: force realtime sync
```

#### Time-off Requests
```
POST   /requests                   Submit new request
GET    /requests                   List (role-scoped: employee sees own, manager sees team)
GET    /requests/:id               Single request
PATCH  /requests/:id/approve       Manager approves
PATCH  /requests/:id/reject        Manager rejects (body: { reason })
DELETE /requests/:id               Employee cancels (PENDING only)
```

#### Admin
```
GET  /admin/stats          Dashboard statistics
GET  /admin/sync-logs      HCM sync history
GET  /admin/discrepancies  Stale / mismatched balances
POST /admin/reconcile      Trigger manual reconciliation
GET  /admin/audit-logs     Full audit trail
```

---

## HCM Mock Server

The mock simulates a real HCM (Workday/SAP-style) with configurable failure modes.

### Debug endpoints (dev/test only)
```
GET  /health                          Health check
GET  /hcm/debug/balances              View all in-memory balances
POST /hcm/debug/anniversary           Manually trigger anniversary bonus
     body: { employeeId, locationId, days? }
POST /hcm/debug/failure-mode          Set failure mode for testing
     body: { mode: "normal"|"error"|"silent", rate?: 0-1 }
```

## Test Suite

```bash
# Run all tests
npm run test --workspace=apps/backend

# With coverage report
npm run test:coverage --workspace=apps/backend

# Watch mode
npm run test:watch --workspace=apps/backend
```

### Test structure

```
test/
├── unit/
│   ├── balance.service.spec.ts      Balance logic, pending lock, batch dedup
│   └── request.service.spec.ts      FSM transitions, validation, RBAC
├── integration/
│   └── request-lifecycle.integration.spec.ts   Full HTTP via Supertest + in-memory SQLite
└── e2e/
    └── hcm-contract.e2e.spec.ts     HCM contract tests with inline mock server
```

### Coverage targets (enforced)
- Lines: 80%
- Functions: 80%
- Branches: 70%
- Statements: 80%

---

## Key Design Decisions

### 1. Dual-write consistency
Every `GET /balances/me` fires a background (non-blocking) HCM realtime sync.
A scheduled cron reconciles all balances every 30 minutes.
Mismatches are logged to `hcm_sync_logs` and surfaced in the Admin discrepancies view.

### 2. Defensive pre-validation
We validate balance sufficiency **locally** before calling HCM.
This guards against HCM silently swallowing bad requests (per spec requirement).
HCM errors are still caught and surfaced but are not the sole gatekeeper.

### 3. Pending days lock
On `POST /requests`:
- `balance.pendingDays` is incremented immediately
- `availableDays = totalDays - usedDays - pendingDays` is the safe figure shown to users
- On `APPROVE`: `pendingDays--`, `usedDays++`
- On `REJECT/CANCEL`: `pendingDays--` only

This prevents double-booking while a request awaits manager review.

### 4. Batch idempotency
Batch ingest hashes the payload with SHA-256.
If the hash matches the last successful batch, ingest is skipped — no redundant writes.

### 5. Optimistic locking
`balance.version` (TypeORM `@VersionColumn`) prevents concurrent update races.

---

## Frontend Routes

| Path | Role | Page |
|---|---|---|
| `/login` | Public | Login |
| `/employee` | Employee+ | Balance dashboard |
| `/employee/requests` | Employee+ | My requests |
| `/employee/new-request` | Employee+ | Submit request |
| `/manager` | Manager+ | Team overview |
| `/manager/approvals` | Manager+ | Pending approvals |
| `/manager/history` | Manager+ | Request history |
| `/admin` | Admin | Sync dashboard |
| `/admin/sync-logs` | Admin | Full sync history |
| `/admin/discrepancies` | Admin | Stale balances |
| `/admin/batch` | Admin | Batch import |

---

```
#
