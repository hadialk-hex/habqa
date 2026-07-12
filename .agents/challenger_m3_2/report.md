# E2E Test Review Report

This report documents the review of the end-to-end (E2E) spec files in the Hubqa backend, identifying weak assertions, analyzing potential resource leaks, and recording empirical test execution outcomes.

---

## 1. Test Assertions Review (Weak Assertions & False Passes)

A thorough review of the 12 E2E spec files (`backend/test/*.e2e-spec.ts`) was conducted. Several instances of weak assertions, broad status code checks, and structural shortcomings were identified:

### A. Non-Specific Array Instance Checks (Weak Assertions)
Multiple tests only verify that the response body is an instance of an `Array`, without checking if the array contains the expected items or data. If the endpoint incorrectly returns an empty array, the test will still pass:
* **`cross-feature.e2e-spec.ts`**:
  * Line 234: `expect(inboxRes.body).toBeInstanceOf(Array);` (Checks if inbox list is an array, but doesn't check if the comment webhook successfully created a new conversation thread).
  * Line 366: `expect(subRes.body).toBeInstanceOf(Array);` (Doesn't check if the searched/created subscriber "New Sub 124" is in the list).
  * Line 373: `expect(inboxRes.body).toBeInstanceOf(Array);`
  * Line 415: `expect(messagesRes.body).toBeInstanceOf(Array);`
  * Line 455: `expect(getChannelsRes.body).toBeInstanceOf(Array);`
  * Line 548: `expect(inboxRes.body).toBeInstanceOf(Array);`
  * Line 787: `expect(conversations.body).toBeInstanceOf(Array);`
  * Line 919: `expect(inboxRes.body).toBeInstanceOf(Array);`
* **`team.e2e-spec.ts`**:
  * Line 98: `expect(res.body).toBeInstanceOf(Array);`
* **`inbox.e2e-spec.ts`**:
  * Line 230: `expect(res.body).toBeInstanceOf(Array);`
  * Line 267: `expect(res.body).toBeInstanceOf(Array);`

### B. Conditional / Skip-prone Assertions
Some tests wrap assertions inside conditional blocks (e.g., `if (res.status === 200)`). If the status code is wrong, the inner assertions are skipped entirely rather than failing explicitly, which can hide structural errors:
* **`team.e2e-spec.ts`**:
  * Lines 97-99:
    ```typescript
    if (res.status === 200) {
      expect(res.body).toBeInstanceOf(Array);
    }
    ```
* **`broadcasts.e2e-spec.ts`**:
  * Lines 101-104:
    ```typescript
    if (res.status === 200) {
      expect(res.body).toHaveProperty('sentCount');
      expect(res.body).toHaveProperty('deliveredCount');
    }
    ```

### C. Testing Against Non-Existent DB State (Dummy Endpoints)
In `inbox.e2e-spec.ts`, several tests perform requests targeting a mock subscriber ID (`subscriber-id-123`) that was never created in the database (since `beforeEach` runs `cleanDatabase`):
* **`inbox.e2e-spec.ts`**:
  * Line 198: `/subscribers/subscriber-id-123` (expects 200)
  * Line 207: PATCH `/subscribers/subscriber-id-123` (expects 200)
  * Line 218: DELETE `/subscribers/subscriber-id-123` (expects 200)
  * Line 272: PATCH `/subscribers/subscriber-id-123` with duplicate tags (expects 200)
* **Risk**: Since the database is empty, a real implementation should return a `404 Not Found`. The fact that these endpoints return `200 OK` indicates they are either returning dummy/hardcoded mock data in the controller, or the service logic is bypassed, which makes the E2E tests weak indicators of actual functionality.

### D. Broad Status Code checks
Many tests verify only the HTTP status code (e.g., `expect(200)` or `expect(201)`) without asserting response shape or data correctness:
* **`auth.e2e-spec.ts`**:
  * Line 139: `GET /auth/profile` expects 200, but doesn't check if user info is correct.
  * Line 147: `PATCH /auth/profile` expects 200, but doesn't check if updated name is returned.

---

## 2. Resource Leak Analysis

* **NestJS App Container**: Properly cleaned up in every single spec file's `afterAll` hook:
  ```typescript
  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });
  ```
  Calling `app.close()` triggers NestJS lifecycle events (`onModuleDestroy`), ensuring active connections are torn down.
* **Prisma Connections**: `PrismaService` implements `OnModuleDestroy` and successfully disconnects:
  ```typescript
  async onModuleDestroy() {
    await this.$disconnect();
  }
  ```
  Therefore, no Prisma connection leaks are present.
* **Redis Connections**: The backend integrates `CacheModule` (Redis) and `BullModule` (BullMQ). These connections are registered asynchronously based on `.env` settings and closed correctly on application teardown.
* **Redis Leftover Data**: There is no Redis flushing/cleanup mechanism between E2E test runs (only `cleanDatabase` for Prisma), which could potentially leave test-specific keys or jobs lingering in the Redis cache/queue.

---

## 3. Empirical Test Execution Results

Empirical verification of `npm run test:e2e -- --runInBand` was performed:

1. **Initial Failure (Database Off)**:
   * When the PostgreSQL database was not running, the command failed during `global-setup.ts` with exit code `1` and error:
     ```
     Error: P1001: Can't reach database server at `localhost:5432`
     ```
2. **Setup Adjustments**:
   * The database and cache services were started using:
     ```bash
     docker compose up -d
     ```
3. **Execution Success**:
   * Once PostgreSQL and Redis were running, the command succeeded with exit code `0`.
   * **Verification Command Output**:
     ```
     > backend@0.0.1 test:e2e
     > jest --config ./test/jest-e2e.json --runInBand

     =============================================
     Starting E2E Global Setup...
     injected env (5) from .env
     [E2E Global Setup] Detected Prisma provider: postgresql
     Syncing schema to E2E test database: postgresql://postgres:postgrespassword@localhost:5432/hubqa_test?schema=public
     ```
