# Challenge Report - Milestone 4 Subscribers & Inbox Upgrade

## Challenge Summary

**Overall risk assessment**: LOW (All 18 adversarial E2E/stress test scenarios pass successfully after mitigating test-suite infrastructure lock bottlenecks).

## Challenges

### [Medium] Challenge 1: E2E Database Deadlocks Under Concurrency and Active Background Tasks

- **Assumption challenged**: Database cleanup utility (`cleanDatabase` using `TRUNCATE TABLE ... RESTART IDENTITY CASCADE`) is safe under concurrent request execution or when background tasks (BullMQ workers, NestJS Scheduled crons) are active.
- **Attack scenario**: During test teardown/setup, the database cleanup executes `TRUNCATE TABLE`, which requests an `AccessExclusiveLock` on all target relations. Simultaneously, background BullMQ queue listeners and NestJS cron jobs run queries (holding `RowShareLock` or `RowExclusiveLock` on tables like `User` or `Tenant`). This leads to Postgres SQL deadlocks (Error code `40P01`) causing random test failures.
- **Blast radius**: Complete disruption of E2E test runs with random `500 Internal Server Error` failures during authentication/registration requests.
- **Mitigation**: Replaced PostgreSQL `TRUNCATE TABLE ... CASCADE` with sequential, non-blocking `deleteMany()` operations in `backend/test/db-cleanup.ts` ordered correctly by foreign key dependencies. This allows concurrent readers/writers to safely coordinate locks without deadlocking.

### [Low] Challenge 2: Empty JSON Body Parsing Behavior in E2E Verification

- **Assumption challenged**: Testing framework `supertest`'s `res.body` property will be `null` when NestJS controllers return `null`.
- **Attack scenario**: The `GET /subscribers/:id/conversation` endpoint returns `null` when no conversation matches the subscriber. NestJS serializes this to status `200` with an empty response body `""`. Supertest parses empty JSON bodies as `{}` (empty object) rather than `null`, causing test assertions checking `res.body` to fail.
- **Blast radius**: Test failures on valid null-returning controller endpoints.
- **Mitigation**: Upgraded the test assertions to check `res.text` directly (`expect(res.text).toBe('')`) which correctly represents the empty response body.

## Stress Test Results

- **Pagination boundary checks** (`GET /subscribers` with negative, non-numeric page/limit, or huge page limit parameters) → Falls back safely to default pagination limits/full list without throwing exceptions → **PASS**
- **SQL/Regex Injection safety** (`GET /subscribers` search query using `%`, `_`, `\`, `'`, `"`, `.*`, `[a-z]`) → Sanitized and executed safely by Prisma ORM without query crashes → **PASS**
- **Cross-Tenant resource segregation** (`GET /subscribers`, `GET /subscribers/:id/conversation`, `PATCH /inbox/conversations/:id/assign` from Tenant B accessing Tenant A resources) → Correctly segregates data and returns 404/empty responses as appropriate → **PASS**
- **Graceful Collision Handling** (Multiple subscribers with identical names but different phone numbers/emails) → Fetches the matching conversation history correctly without crashing or data leakage → **PASS**
- **Assignee access control** (`PATCH /inbox/conversations/:id/assign` with different-tenant member or non-existent member) → Returns 400 Bad Request → **PASS**
- **Unique tags retrieval** (`GET /subscribers/tags` and `GET /subscribers/stats`) → Correctly returns isolated metrics and unique tags for the requesting tenant only → **PASS**

## Unchallenged Areas

- **Frontend/UI State Isolation**: Verify that React/frontend component caches don't leak subscriber or inbox data across tenant logins. (Out of scope for backend E2E verification).
