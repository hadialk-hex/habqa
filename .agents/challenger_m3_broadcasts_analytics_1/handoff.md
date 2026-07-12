# Handoff Report — Challenger 1 (Milestone 3)

## 1. Observation

- **Dashboard Trend Math**:
  In `backend/src/dashboard/dashboard.service.ts` lines 105-110:
  ```typescript
  105:     const calcTrend = (curr: number, prev: number) => {
  106:       if (curr === 0 && prev === 0) return 0;
  107:       if (prev === 0) return curr > 0 ? 100 : 0;
  108:       const pct = ((curr - prev) / prev) * 100;
  109:       return Math.round(pct * 100) / 100;
  110:     };
  ```
- **Campaign Cron Concurrency**:
  In `backend/src/broadcasts/broadcasts.service.ts` lines 212-218:
  ```typescript
  212:     for (const b of scheduled) {
  213:       try {
  214:         await this.execute(b.tenantId, b.id);
  215:       } catch (err) {
  216:         // Log/handle execute failure silently to not disrupt other executions
  217:       }
  218:     }
  ```
- **Campaign Execution State Change**:
  In `backend/src/broadcasts/broadcasts.service.ts` lines 70-73 and 141-144:
  ```typescript
  70:   async execute(tenantId: string, id: string) {
  71:     const broadcast = await this.prisma.broadcast.findFirst({
  72:       where: { id, tenantId },
  73:     });
  ...
  141:     return this.prisma.broadcast.update({
  142:       where: { id },
  143:       data: {
  144:         status: 'SENT',
  ```
- **Frontend Error Catching**:
  In `frontend/src/app/dashboard/page.tsx` lines 31-33:
  ```typescript
  31:       } catch (err) {
  32:         console.error("Error fetching stats:", err)
  33:       }
  ```
- **Empirical Execution**:
  Ran the custom verification test suite `backend/test/m3-challenger.e2e-spec.ts` using `npx jest --config ./test/jest-m3-mocked.json`. All 6 tests passed, verifying sequential execution, the race condition vulnerability, and trend boundary maths.

## 2. Logic Chain

- **Trend Calculations**:
  - Going from `0` to `0` returns `0` (equivalent to `0.0`).
  - Going from `0` to `5` returns `100` (equivalent to `100.0`).
  - However, when previous numbers are negative (e.g. `prev = -10, curr = -5`), `pct = ((-5 - (-10)) / -10) * 100` returns `-50%` (calculating an increase as a decrease). Conversely, going from `-5` to `-10` returns `+100%` (calculating a decrease as an increase).
- **Campaign Execution Concurrency**:
  - The use of `await this.execute(...)` inside the `for...of` loop of `handleScheduledBroadcasts()` blocks the execution of the next campaign until the current one finishes. Thus, multiple campaigns scheduled at the same time are executed **sequentially**, not concurrently.
- **Double Execution Race Condition**:
  - The campaign status is only updated from `SCHEDULED` to `SENT` at the very end of `execute()`, after iterating through all subscribers.
  - Since there is no intermediate status (like `PROCESSING`) set immediately when fetching the campaign, and no database lock is acquired, another cron cycle triggered while `execute()` is still running will fetch the same campaign again and execute it a second time in parallel.
- **Frontend Invalid Range Error**:
  - If a user specifies `startDate` > `endDate`, the backend responds with a 400 Bad Request. The frontend catches it in `try...catch` and only logs to console, resulting in a silent failure without telling the user what was wrong.

## 3. Caveats

- Tests were run utilizing Jest mocks for Prisma due to a Docker permission timeout on the host system. High concurrency locking behaviors on a live PostgreSQL instance were not directly measured.

## 4. Conclusion

- **Trend Calculation**: Mathematically correct for non-negative integers (returns `0.0` for 0->0, `100.0` for 0->>0, no overflow on large numbers), but behaves incorrectly for negative numbers.
- **Scheduler**: Does not execute campaigns concurrently (runs sequentially) and suffers from a critical double-execution race condition.
- **Frontend**: Handles empty states and loader states gracefully, but does not display user-facing validation errors for invalid date ranges.

## 5. Verification Method

To verify these findings, run the mocked test suite:
```bash
cd backend
npx jest --config ./test/jest-m3-mocked.json
```
If the tests pass, the sequential execution behavior and the double-execution vulnerability are verified.
