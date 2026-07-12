## 2026-07-11T10:31:43Z
You are teamwork_preview_worker. Your working directory is c:\Users\pc\Desktop\face bot\.agents\worker_m5_victory_fix\.
Mission: Investigate and resolve all E2E test failures in the project (including inbox, adversarial, team, rate-limiting, and broadcasts), ensuring full compatibility of webhook and subscriber logic with the PostgreSQL schema changes (specifically `tags` being a native string array `String[]` in the database, e.g. `tags: []`, instead of a JSON/comma-separated string).

Tasks:
1. Run all E2E test suites in the `backend` folder:
   `node node_modules/jest/bin/jest.js --config ./test/jest-e2e.json --runInBand`
   Note down all test failures.
2. In `backend/src/webhooks/webhooks.service.ts`:
   - Inspect all places where `tags` is assigned when creating/updating subscribers. Ensure it is passed as a string array (e.g., `tags: []`) rather than a single string.
   - Clean up any multi-tenant leakage issues (ultimate fallbacks) as flagged by Reviewer 5:
     - Remove connection lookup fallbacks that fetch the first arbitrary connection in the database when the correct connection matching the event's `platformId` or `phone_number_id` is missing.
     - Enforce strict early returns (`if (!connection) return;`) to preserve multi-tenant isolation.
     - For the WhatsApp E2E tests and cross-feature Test 124, ensure that a proper WhatsApp connection with the correct phone number ID is seeded in the test databases rather than relying on fallbacks.
   - Fix the deduplication race conditions: do not catch and ignore unique constraint errors. If a unique constraint write fails (P2002), return early (skip duplicate processing) instead of proceeding.
   - Align database persistence with Graph API call success: save outbound comment and DM records in the database only when the API fetch response is successful (e.g. `response.ok === true`).
   - Harden token security: pass the decrypted token in the HTTP `Authorization: Bearer <token>` header instead of query parameters.
3. Fix E2E test suites to seed proper connections:
   - For WhatsApp tests in `webhooks.e2e-spec.ts` and `cross-feature.e2e-spec.ts` (Test 124), make sure they seed the correct WhatsApp `PlatformConnection` before executing webhooks.
4. Investigate and fix any other failing E2E tests (inbox, adversarial, team, rate-limiting, broadcasts).
5. Run the full E2E test suite to verify that ALL tests pass.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT
hardcode test results, create dummy/facade implementations, or
circumvent the intended task. A Forensic Auditor will independently
verify your work. Integrity violations WILL be detected and your
work WILL be rejected.
