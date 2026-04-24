# How to Run — ExampleHR Time-Off System

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 20+ | `node -v` |
| npm | 9+ | `npm -v` |

---

## Step 1 — Install dependencies

```bash
cd timeoff-system
npm install
```

This installs packages for all three workspaces (backend, hcm-mock, frontend) in one command.

---

## Step 2 — Configure environment

```bash
cp .env.example .env
```

The defaults work out of the box for local development. You do not need to change anything.

---

## Step 3 — Start everything

```bash
npm run dev
```

This starts all three services in parallel with coloured output:

| Label | Service | URL |
|-------|---------|-----|
| `BACKEND` (blue) | NestJS API | http://localhost:3000 |
| `HCM-MOCK` (yellow) | Fastify mock HCM | http://localhost:3001 |
| `FRONTEND` (green) | React + Vite | http://localhost:5173 |

On first run the backend auto-creates `apps/backend/data/timeoff.db` and seeds demo accounts.

---

## Step 4 — Open the app

Go to **http://localhost:5173** and log in with any demo account:
 click the quick-fill buttons on the login screen.

---

## Explore the API

Swagger UI → **http://localhost:3000/api/docs**

All endpoints require a Bearer token. Use the login endpoint first to get one,
then click "Authorize" in Swagger and paste it.

---

## Run tests

```bash
# Unit + integration tests
npm run test

# With coverage report (opens in coverage/lcov-report/index.html)
npm run test:coverage

# E2E / HCM contract tests (spins up an inline mock HCM server)
npm run test:e2e
```

---

## Run services individually

```bash
npm run dev:backend    # NestJS only  (port 3000)
npm run dev:mock       # HCM mock only (port 3001)
npm run dev:frontend   # React only   (port 5173)
```

---

## Test the HCM mock directly

```bash
# Health check
curl http://localhost:3001/health

# View all in-memory balances
curl http://localhost:3001/hcm/debug/balances

# Manually trigger a work-anniversary bonus (+2 days ANNUAL)
curl -X POST http://localhost:3001/hcm/debug/anniversary \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"<id>","locationId":"LOC-001","days":2}'

# Set 30% silent failure rate (tests defensive pre-validation)
curl -X POST http://localhost:3001/hcm/debug/failure-mode \
  -H "Content-Type: application/json" \
  -d '{"mode":"silent","rate":0.3}'

# Reset to normal
curl -X POST http://localhost:3001/hcm/debug/failure-mode \
  -H "Content-Type: application/json" \
  -d '{"mode":"normal","rate":0}'
```

---

## Project layout

```
timeoff-system/
├── apps/
│   ├── backend/            NestJS microservice
│   │   ├── src/
│   │   │   ├── modules/    auth / balance / request / admin / sync
│   │   │   └── database/   entities + seed
│   │   └── test/
│   │       ├── unit/       balance.service.spec, request.service.spec
│   │       ├── integration/ full HTTP lifecycle via Supertest
│   │       └── e2e/        HCM contract tests with inline mock server
│   ├── hcm-mock/           Fastify mock of Workday/SAP
│   └── frontend/           React + Vite + Tailwind v4
│       └── src/
│           ├── features/   employee / manager / admin portals
│           ├── store/       RTK Query + auth slice
│           ├── router/      role-based route guards
│           └── components/  shared UI (Button, Modal, Input, etc.)
├── .env.example
├── README.md
└── HOW_TO_RUN.md  ← you are here
```

---

## Common issues

**Can't log in / "Login failed"**
The database seed may not have run correctly. Delete the DB and restart:
```bash
rm -f apps/backend/data/timeoff.db
npm run dev:backend   # wait for "Database seeded successfully" in logs, then start frontend
```
Also make sure the **backend is running** before trying to log in.
You should see `🚀 Backend running at http://localhost:3000/api/v1` in the terminal.

**`EADDRINUSE: address already in use`**
Something is already on port 3000, 3001 or 5173. Kill it:
```bash
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

**`Cannot find module 'better-sqlite3'`**
The native addon needs to build. Run:
```bash
cd apps/backend && npm rebuild better-sqlite3
```

**Styles not loading in browser**
Make sure you ran `npm install` from the root (not inside `apps/frontend`).
The `@tailwindcss/vite` plugin must be installed.

**Database is stale / want a fresh start**
```bash
rm apps/backend/data/timeoff.db
npm run dev:backend   # will re-seed automatically
```
