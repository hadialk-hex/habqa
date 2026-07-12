# Milestone 3 Review Report — Broadcasting & Analytics

## Quality Review Summary

**Verdict**: REQUEST_CHANGES

The implementation of Milestone 3 has solid progress, including full RTL layouts, Dark Neon theme compliance (zero purple color codes in TSX, only green/teal/cyan gradients), and functional NestJS endpoints and crons. However, changes are requested due to critical issues:
1. **Frontend Compilation Failure**: A TypeScript compilation error in `src/app/dashboard/subscribers/page.tsx` blocks frontend build.
2. **Backend Unit Test Failure**: `npm run test` fails on `src/challenger.spec.ts` due to a mismatch in Prisma mock verification (`platform: null` payload).
3. **Backend E2E Test Suite Run Blocked**: E2E tests cannot connect to the database in global setup because of port (5432 vs 5433) and password (`postgrespassword` vs `password`) mismatches.
4. **Dashboard Analytics Date Calculation Bug**: Serious date boundary bugs in `dashboard.service.ts` cause broken dates when calculating previous period starts across month boundaries.

---

## Findings

### Critical Finding 1: Frontend TypeScript Compilation Error
- **What**: TypeScript compilation fails on the Subscribers page.
- **Where**: `frontend/src/app/dashboard/subscribers/page.tsx`, line 201:
  ```typescript
  <Select value={platform} onValueChange={(val) => { setPlatform(val); setPage(1); }}>
  ```
- **Why**: The `<Select>` component from `@base-ui/react/select` passes `string | null` to `onValueChange`. However, `setPlatform` expects a strict `string` type. This type mismatch blocks the production build (`npm run build` exits with code 1).
- **Suggestion**: Add a null check before calling state setters, or cast the value:
  ```typescript
  onValueChange={(val) => { if (val) { setPlatform(val); setPage(1); } }}
  ```

### Critical Finding 2: Backend Unit Test Failure
- **What**: Unit test `create - should format tags correctly` fails.
- **Where**: `backend/src/challenger.spec.ts`, line 186.
- **Why**: The `subscribersService.create` method is now passing `platform: null` to the Prisma database creation call. However, the mock assertion `expect(mockPrismaService.subscriber.create).toHaveBeenCalledWith(...)` does not include `"platform": null` in its expected payload.
- **Suggestion**: Update `challenger.spec.ts` line 186 to include `"platform": null` in the mock creation payload expectation.

### Major Finding 3: Backend E2E Test Suite Connection Failure
- **What**: E2E tests exit immediately with code 1 during global setup.
- **Where**: `backend/test/global-setup.ts`, line 80 and line 136.
- **Why**:
  - The E2E script tries to connect to `127.0.0.1:5432` with password `postgrespassword`.
  - However, `docker-compose.yml` maps port `5433:5432` and defines the password as `password`.
  - In addition, the health check inspects `hubqa-postgres`, whereas the compose container might be named `hubqa_postgres` depending on the environment, causing healthchecks to timeout or fail, exiting the setup with code 1.
- **Suggestion**: Align E2E default database URLs and credentials in `global-setup.ts` and `setup.ts` to connect to port `5433` and use the password defined in compose or config.

### Major Finding 4: Dashboard Stats Date Range Mutation Bug
- **What**: Bug in date ranges for previous period calculations.
- **Where**: `backend/src/dashboard/dashboard.service.ts`, lines 74-93:
  ```typescript
  previousEnd = new Date(currentStart);
  previousStart = new Date();
  previousStart.setDate(previousEnd.getDate() - 7);
  ```
- **Why**: `previousStart` is initialized with `new Date()` (the current local time). When mutating it with `setDate(previousEnd.getDate() - 7)`, it applies the day offset to the *current month and year* instead of `previousEnd`'s month and year. If `previousEnd` falls in a different month, this creates impossible dates (e.g. `previousStart` in October being after `previousEnd` in September).
- **Suggestion**: Initialize `previousStart` by copying `previousEnd`:
  ```typescript
  previousStart = new Date(previousEnd.getTime());
  previousStart.setDate(previousStart.getDate() - 7);
  ```

---

## Verified Claims

- **GET /broadcasts implementation** → verified via `view_file` on `broadcasts.controller.ts` & `broadcasts.service.ts` → **pass** (correct multi-tenant scope and sorting).
- **Scheduled Broadcasts Cron Job** → verified via `view_file` on `broadcasts.service.ts` → **pass** (correctly runs every minute, checks scheduled date, executes).
- **RTL & Tajawal font support** → verified via `view_file` on root layout `layout.tsx` → **pass** (correctly includes `dir="rtl"` and `font-sans` with Tajawal).
- **Zero Purple Color compliance** → verified via recursive search for `purple|violet|8b5cf6` in `frontend/src` → **pass** (zero occurrences in TSX/CSS code; only one descriptive comment in `globals.css` exists).

---

## Coverage Gaps
- **Database E2E Coverage** — risk level: **medium** — recommendation: Resolve the credentials mismatch in `global-setup.ts` to allow full execution of the 135 E2E tests, verifying that the broadcast flows don't lock up or cause SQLite/Postgres conflicts.

---

## Unverified Items
- **Actual execution of the 135 E2E tests** — E2E database connection mismatch blocked running the suite.

---
---

## Adversarial Review Challenge Summary

**Overall risk assessment**: MEDIUM

Constructing boundary cases and stress-testing the date metrics highlights that while frontend layouts are visual-conforming, timezone and month boundary conversions pose a silent corruption risk to user dashboard metrics.

## Challenges

### Major Challenge 1: Local vs UTC Timezone Shift in Timeline
- **Assumption challenged**: That `.toISOString().split('T')[0]` is safe for timeline date grouping.
- **Attack scenario**: A message created at `2026-07-05 01:00:00` local time in UTC+4 is `2026-07-04 21:00:00` UTC. When grouping in `getStats` using `.toISOString()`, the message falls under `"2026-07-04"`, but the local timeline day was July 5.
- **Blast radius**: Outbound replies and stats charts show data shifted by 1 day for users in eastern time zones, leading to mismatch complaints between dashboard graphs and chat histories.
- **Mitigation**: Perform timezone grouping on database queries (using Postgres `timezone` or local date conversion helpers) instead of formatting pure UTC ISO strings.

---

## Stress Test Results

- **Cross-month date boundary query (e.g. current date Oct 5, querying 7 days)** → **Expected**: Previous period stats represent Sep 21 - Sep 28 → **Actual**: Previous period becomes Oct 21 - Sep 28 (inverted start/end) due to `new Date()` mutation bug → **FAIL**

---

## Unchallenged Areas
- **Meta/WhatsApp Graph API payloads** — Simulated mock models used; actual Meta API payload formatting under high-volume load was not checked because it was mocked at the provider level.
