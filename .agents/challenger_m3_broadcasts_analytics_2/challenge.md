# Adversarial Challenge Report — Milestone 3 (Broadcasting & Analytics)

## Challenge Summary

**Overall risk assessment**: **MEDIUM**

While the core flow is functional and unit/E2E test suites exist, several critical weaknesses, silent failure modes, and race conditions were identified in the backend broadcast execution and cron scheduler. Additionally, a pre-existing unit test is currently failing.

---

## Challenges

### [High] Challenge 1: Silent Error Swallowing in Background Cron (No Logs Generated)
- **Assumption challenged**: Background execution failures are logged and visible to administrators for debugging.
- **Attack/Failure scenario**: Inside `handleScheduledBroadcasts` in `broadcasts.service.ts`, each scheduled broadcast is executed inside a `try-catch` block. However, the `catch (err)` block is completely empty:
  ```typescript
  try {
    await this.execute(b.tenantId, b.id);
  } catch (err) {
    // Log/handle execute failure silently to not disrupt other executions
  }
  ```
  If a campaign fails due to a database write error, missing platform connection, or invalid subscriber payload inside `execute`, the exception is silently swallowed. No errors are printed to the console or log files.
- **Blast radius**: Administrators and developers will have no visibility into why scheduled campaigns remain stuck or fail to reach subscribers. Critical system failures (e.g., API limits, token expiration, database locks) will go completely unnoticed.
- **Mitigation**: Implement robust logging within the catch block using NestJS `Logger` or `console.error(err)` to record the broadcast ID, tenant ID, and exact exception stack.

### [Medium] Challenge 2: Unhandled Query Exceptions in Cron Runner
- **Assumption challenged**: The cron runner is fully resilient to database hiccups.
- **Attack/Failure scenario**: The initial DB call inside `handleScheduledBroadcasts` to fetch scheduled campaigns is not wrapped in any `try-catch` block:
  ```typescript
  const scheduled = await this.prisma.broadcast.findMany({ ... });
  ```
  If the database connection is momentarily lost or timed out when the cron triggers, this line throws an unhandled exception. This bubbles up to the NestJS Schedule registry. While it doesn't crash the entire Node process, it skips the entire run and fails to process *any* pending scheduled broadcasts for that minute.
- **Blast radius**: Temporary DB network blips will abort the entire scheduler interval, delaying time-sensitive broadcasts.
- **Mitigation**: Wrap the entire body of `handleScheduledBroadcasts` in a try-catch block to handle database lookup errors gracefully.

### [Medium] Challenge 3: Lack of Concurrency and Status Checks in Execute (Race Condition)
- **Assumption challenged**: Broadcasts are only executed once.
- **Attack/Failure scenario**: The `execute` method fetches the broadcast but does *not* verify whether the broadcast's current status is actually `SCHEDULED` or `DRAFT`.
  If an administrator manually calls `POST /broadcasts/:id/execute` while the cron is running, or if the cron execution takes longer than 1 minute (due to sequential processing of thousands of subscribers), the subscriber loop will run multiple times in parallel for the same broadcast.
- **Blast radius**: Subscribers will receive duplicate messages, spamming customers and violating platform policies (potentially leading to Meta account bans).
- **Mitigation**: Add a status check at the start of `execute` (e.g., `if (broadcast.status === 'SENT' || broadcast.status === 'CANCELLED') throw new BadRequestException(...)`) and use a database transaction or state lock (e.g., setting status to `SENDING` first) to prevent double execution.

### [Low] Challenge 4: Scale Bottleneck via Sequential Processing
- **Assumption challenged**: The sequential loop is sufficient for broadcasting.
- **Attack/Failure scenario**: The subscriber messaging loop in `execute` runs sequentially using `await this.prisma.message.create(...)` for each subscriber. For large audiences (e.g., 5,000 subscribers), this single-threaded execution will block the database connection pool and cause the execution to run for several minutes, triggering concurrent scheduler overlaps.
- **Blast radius**: Low-speed execution, database connection timeouts, and delayed message delivery.
- **Mitigation**: Batch subscriber message creation or offload execution to a background queue system (e.g., BullMQ, which is already a dependency in `package.json`).

### [Low] Challenge 5: Pre-existing Test Suite Failure
- **Assumption challenged**: The codebase has a fully passing test suite.
- **Attack/Failure scenario**: Running `npx jest src/challenger.spec.ts` fails on `Empirical Challenger M3 Test Suite > 2. Subscribers Module > create - should format tags correctly` due to a mismatch in expected mock call arguments:
  ```
  - Expected: data without "platform"
  + Received: data containing "platform: null"
  ```
- **Blast radius**: Fails CI/CD pipelines and hides other potential regressions.
- **Mitigation**: Update `challenger.spec.ts` line 186 to include `"platform": null` inside the expected `data` payload of the mock assertion.

---

## Stress Test Results

- **Database Connection Failure during Cron** → Unhandled exception bubbles out of the cron scheduler → **FAIL** (resilience issue).
- **Campaign Execution Exception (e.g. invalid subscriber)** → Silently swallowed, no logs generated → **FAIL** (observability issue).
- **Double execution of GET /execute / cron overlap** → Loops execute in parallel, sending duplicate messages → **FAIL** (race condition/idempotency issue).
- **GET /broadcasts robustness** → Secured by JwtAuthGuard, scoped to tenantId. No unsafe query inputs accepted → **PASS** (robust).
- **Frontend Recharts empty data state** → Renders standard Arabic message placeholder when `totalActivity === 0` → **PASS** (handled gracefully).
- **Frontend Recharts layout reflow on resize** → Constrained by a fixed height container (`h-64`) and uses `<ResponsiveContainer>` to adapt width dynamically → **PASS** (resilient).

---

## Unchallenged Areas

- **OAuth Graph API token encryption logic** — Excluded as it was outside of the specific scope of Milestone 3 Broadcasts & Analytics.
