# Progress updates

Last visited: 2026-07-11T10:15:30Z

- Initial state: E2E tests in `cross-feature.e2e-spec.ts` had several failures due to:
  1. WhatsApp Webhook implementation issues (using hardcoded fallback connections instead of dynamically resolving WHATSAPP platform connections or defaulting correctly, failing to associate subscriber with inbox conversations).
  2. Lack of dynamic JWT token invalidation when owner passwords are reset, leading to stale session access bypasses.
  3. Strict rate limiting in the test environment causing `429 Too Many Requests` on high-volume campaign subscriber insertions.
  4. Missing `WebhookDeduplication` table cleanup in E2E `cleanDatabase` causing duplicate event skips across runs.
  5. SQLite connection pool starvation deadlocks because `connection_limit` was set to 1.
  6. Missing `afterAll` app teardown hook leaving database connection locks dangling.
- Fixes implemented:
  - Updated WhatsApp message processing in `webhooks.service.ts` to properly resolve `platformId` dynamically and connect WhatsApp channels correctly.
  - Implemented dynamic, deterministic token invalidation in `jwt.strategy.ts` by signing a password hash signature (`pwSig`) in JWT payloads and checking it against the current hash in the database.
  - Resolved E2E rate limiting by setting `process.env.NODE_ENV = 'test'` in `setup.ts` so `ThrottlerGuard` uses the huge limit of `999999`.
  - Added `WebhookDeduplication` to the list of models cleaned in `db-cleanup.ts`'s `cleanDatabase`.
  - Upgraded SQLite database pool connection limit to `10` to avoid deadlocks.
  - Added worker-specific SQLite database isolation using `JEST_WORKER_ID` to copy and unlink files per Jest runner thread.
  - Added `afterAll` hook in `cross-feature.e2e-spec.ts` to properly close the application.
- Final state: All 15 E2E tests in `cross-feature.e2e-spec.ts` pass successfully. Linting checks pass cleanly on all modified files.
