## 2026-07-09T14:08:56Z
<USER_REQUEST>
You are the fresh Backend API Worker (worker_3) for Milestone 3 (M3_API_Completeness) of Hubqa.
Your working directory is: c:\Users\pc\Desktop\face bot\.agents\worker_m3_gen3\. Please create this directory if it doesn't exist.
Write your progress updates to c:\Users\pc\Desktop\face bot\.agents\worker_m3_gen3\progress.md and your final handoff report to c:\Users\pc\Desktop\face bot\.agents\worker_m3_gen3\handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your objective is to refactor the backend codebase to remove all security backdoors, hardcoded string bypasses, and weak PRNG token generation from `backend/src/`, while modifying the E2E test files in `backend/test/` to seed their required test data dynamically.

Detailed Tasks:

1. Modify E2E Test Files (`backend/test/`) to seed mock data dynamically:
   Because the test suites run `cleanDatabase` in their `beforeEach` block, sequential test assertions that expect specific records (e.g. subscriber-id-123 or member-id-123) to exist will fail unless they are seeded. Instead of writing hardcoded checks in the production service files, modify the test files to seed these records in their `beforeEach` block, dynamically linking them to the newly registered test tenant IDs:
   - `backend/test/team.e2e-spec.ts`: In `beforeEach`, after registering `owner@example.com` and retrieving `ownerTenantId`, seed a User (email `'newagent@example.com'`, password `'hashed_securepassword123'`) and a TenantMember with id `'member-id-123'`, tenantId `ownerTenantId`, and role `'MEMBER'`.
   - `backend/test/inbox.e2e-spec.ts`: In `beforeEach` (in the Subscriber Management describe block or the top-level block), seed a Subscriber with id `'subscriber-id-123'`, tenantId `tenantId` (the dynamically created tenant ID), name `'Manual Sub'`, phone `'+123456789'`, email `'sub@example.com'`, tags `['promo']`, notes `'Important customer'`.
   - `backend/test/auth.e2e-spec.ts`: In `beforeEach` (or within the Password Reset describe block), seed a User with email `'test@example.com'`, password `'hashed_securepassword123'`, and a membership in the tenant. Also seed a PasswordResetToken with token `'valid_reset_token'`, userId of the user, expiresAt in the future. Seed another PasswordResetToken with token `'expired_reset_token'`, userId of the user, expiresAt in the past (e.g. 1 hour ago).
   - `backend/test/broadcasts.e2e-spec.ts`: In `beforeEach`, seed a Broadcast with id `broadcastId` (assign to the dynamic variable, or use a generated UUID and assign to `broadcastId`), tenantId `tenantId`, status `'DRAFT'`, segmentTarget `'all'`. Also seed a Broadcast with id `'already-sent-id'`, tenantId `tenantId`, status `'SENT'`, segmentTarget `'all'`.
   - In `backend/test/db-cleanup.ts`: Keep `cleanDatabase` clearing the tables (Message, Conversation, AutoReplyRule, PlatformConnection, TenantMember, Tenant, User, Subscriber, TeamInvitation, Broadcast, RevokedToken, PasswordResetToken), but keep `seedDefaultTenant` simple (just seed the demo-tenant-id).

2. Remove all hardcoded string checks and backdoors from Production Source Code under `backend/src/`:
   - `team.service.ts`: Remove the bypass check `member.id === 'member-id-123' && member.tenantId !== tenantId` that updates the tenant ID. Do not hardcode any logic for `'member-id-123'`. Ensure a pure database lookup is executed.
   - `subscribers.service.ts`: Remove the bypass check `if (!subscriber && id === 'subscriber-id-123')` that auto-creates the subscriber.
   - `auth.service.ts`: Remove any hardcoded checks for `'test@example.com'`, `'valid_reset_token'`, `'expired_reset_token'`. Use pure database queries.
   - `broadcasts.service.ts`: Remove any bypass checks for `'mocked-broadcast-id-123'` or `'already-sent-id'`.
   - `inbox.service.ts`: Keep the `sendPlatformMessage` helper that simulates connection token revocation check cleanly, but ensure no other hardcoded bypasses exist.

3. Fix Weak PRNG Vulnerability:
   - In `auth.service.ts` and `team.service.ts`, replace the use of `Math.random()` for token generation with `crypto.randomBytes(32).toString('hex')` or similar cryptographically secure random values (using Node's `crypto` module).

4. Verify Build and Run Tests:
   - Run `npm run build` inside `backend/` and verify that the codebase compiles with no errors.
   - If Docker is running, verify that E2E tests pass.
   - Provide a complete handoff report when done.
</USER_REQUEST>
