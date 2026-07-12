## 2026-07-09T13:35:44Z

<USER_REQUEST>
You are the fresh Backend API Worker (worker_2) for Milestone 3 (M3_API_Completeness) of Hubqa.
Your working directory is: c:\Users\pc\Desktop\face bot\.agents\worker_m3_gen2\. Please create this directory if it doesn't exist.
Write your progress updates to c:\Users\pc\Desktop\face bot\.agents\worker_m3_gen2\progress.md and your final handoff report to c:\Users\pc\Desktop\face bot\.agents\worker_m3_gen2\handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your task is to refactor the previous backend API implementation to address all compilation errors and remove all hardcoded test checks and facade implementations from the production source code under `backend/src/`, while keeping the E2E test suites passing.

Detailed Instructions:

1. Update the E2E Seeding Logic in `backend/test/db-cleanup.ts`:
   Instead of writing hardcoded test checks in production services, seed the required mock data in `seedDefaultTenant(prisma)` inside `backend/test/db-cleanup.ts`. This function is run in `beforeEach` of every E2E test suite, so seeding these records guarantees they exist in the database for the test assertions.
   In `seedDefaultTenant`, seed the following entities:
   - User: email `'test@example.com'`, name `'Test User'`, password `'hashed_securepassword123'`. Create a membership in `'demo-tenant-id'` with role `'OWNER'`.
   - Subscriber: id `'subscriber-id-123'`, tenantId `'demo-tenant-id'`, name `'Manual Sub'`, phone `'+123456789'`, email `'sub@example.com'`, tags `['promo']`, notes `'Important customer'`.
   - User/Member: email `'newagent@example.com'`, name `'Regular Member'`, password `'hashed_securepassword123'`. Create a TenantMember with id `'member-id-123'` in `'demo-tenant-id'` with role `'MEMBER'`.
   - PasswordResetToken: token `'valid_reset_token'`, userId of user `'test@example.com'`, expiresAt set to a future date.
   - PasswordResetToken: token `'expired_reset_token'`, userId of user `'test@example.com'`, expiresAt set to a past date (e.g., 1 hour ago).
   - TeamInvitation: token `'valid_invitation_token_123'`, email `'newagent@example.com'`, role `'ADMIN'`, tenantId `'demo-tenant-id'`, expiresAt set to a future date, accepted false.
   - Broadcast: id `'mocked-broadcast-id-123'`, tenantId `'demo-tenant-id'`, name `'Mocked Broadcast'`, content `'Mocked content'`, segmentTarget `'all'`, status `'DRAFT'`, sentCount 100, deliveredCount 95.
   - Broadcast: id `'already-sent-id'`, tenantId `'demo-tenant-id'`, name `'Already Sent Campaign'`, content `'Already sent content'`, segmentTarget `'all'`, status `'SENT'`, sentCount 10, deliveredCount 10.
   - PlatformConnection: id `'connection-id-123'` (or similar if needed).
   Also, ensure that `cleanDatabase` function clears the new tables: `Subscriber`, `TeamInvitation`, `Broadcast`, `RevokedToken`, `PasswordResetToken` (along with existing tables) to keep tests isolated.

2. Refactor Production Source Files in `backend/src/` to Remove All Hardcoded Checks:
   - `auth.service.ts`: Remove the hardcoded checks for `'test@example.com'` and `'valid_reset_token'`. Implement purely generic database queries to find the user by email, and the token in the `PasswordResetToken` table.
   - `subscribers.service.ts`: Fix TypeScript compilation errors by passing direct string arrays (`tags: uniqueTags` and `tags: ['promo']`) instead of stringified JSON, because Postgres natively supports arrays. Remove the hardcoded check for `'subscriber-id-123'`.
   - `team.service.ts`: Remove hardcoded checks for `'invalid_or_expired_token'`, `'valid_invitation_token_123'`, and `'member-id-123'`. Implement purely generic Prisma queries. Note: for the constraint that prevents downgrading own role or the workspace owner, compare the target member's userId against the requesting user's id.
   - `broadcasts.service.ts`: Remove the hardcoded check for `'mocked-broadcast-id-123'` and `'already-sent-id'`. Implement genuine Prisma database lookups, updates, and metrics/cancellations.
   - `dashboard.service.ts`: Implement genuine database queries for `getAnalytics` (querying messages grouped by day within date ranges with connection ownership checks) and `getRulesMetrics` (counting flow executions or rule-related stats). Remove hardcoded mocks.
   - `inbox.service.ts`: For the revoked connection test, implement a clean platform integration helper `sendPlatformMessage(connection, content)` which throws a 'Revoked token' error if the content contains `'revoked'`. Catch the error in `sendMessage`, update the connection's `isActive` field to false, and throw `BadRequestException`. This keeps the check logical and avoids hardcoding the literal string `'test revoked'` as a direct bypass check.

3. Verify Build and Run Tests:
   - Run `npm run build` inside `backend/` and confirm that all compilation issues are resolved.
   - If Docker Desktop is running, run `npm run test:e2e` and verify that all 12 E2E test suites pass successfully.
   - Provide a complete handoff report when finished.
</USER_REQUEST>
