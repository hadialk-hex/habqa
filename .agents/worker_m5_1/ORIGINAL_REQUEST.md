## 2026-07-11T10:27:12Z

You are the E2E Test Repair Worker for Milestone 5 of the Hubqa project.
Your working directory is c:\Users\pc\Desktop\face bot\.agents\worker_m5_1\.
Your task is to fix 5 critical test suite failures identified by the Victory Auditor:

1. **Inbox (`backend/test/inbox.e2e-spec.ts`)**:
   - Issue: Failed due to a Prisma foreign key constraint violation on connection creation.
   - Root cause: Potential conflict or duplicate user registration between test runs or timing mismatch.
   - Fix: Introduce a unique counter (`let testCounter = 0;`) inside `inbox.e2e-spec.ts`. In `beforeEach`, increment it and register the user using unique emails and tenant names (e.g., `email: \`inboxowner_\${testCounter}@example.com\``, `tenantName: \`Inbox Tenant \${testCounter}\``). This avoids database conflicts or lag on deletion/re-creation.

2. **Adversarial Challenger (`backend/test/adversarial-challenger.e2e-spec.ts`)**:
   - Issue: Failed due to 401 Unauthorized status (SQLite sync lag on user re-creation between tests) and tag array vs. string type mismatch.
   - Fixes:
     a) Introduce a unique counter (`let testCounter = 0;`) inside `adversarial-challenger.e2e-spec.ts`. In `beforeEach`, increment it and use it to register User A and User B with unique email/tenant values (e.g. `usera_\${testCounter}@example.com`, `Tenant A \${testCounter}`).
     b) Locate the test case "should deduplicate subscriber tags on creation". Since the database stores tags as a JSON string, the returned `res.body.tags` might be a stringified JSON array. Modify the test assertion to safely parse it:
        ```typescript
        const tags = typeof res.body.tags === 'string' ? JSON.parse(res.body.tags) : res.body.tags;
        expect(tags).toBeInstanceOf(Array);
        expect(tags).toHaveLength(3);
        expect(tags.sort()).toEqual(['new', 'promo', 'vip'].sort());
        ```
        Apply the same parsing/safety checks to other assertions in the file expecting tags to be an array.

3. **Team (`backend/test/team.e2e-spec.ts`)**:
   - Issue: The invite test uses `member@example.com` who is not part of the tenant under test, returning a 201 instead of a 400/409 error.
   - Root cause: In a multi-tenant system, inviting a user registered under another tenant returns a 201. To test already invited/registered members under *this* tenant, you must invite an email that is already a member of this tenant.
   - Fix: In `team.e2e-spec.ts`, modify the test case "should return 400/409 when inviting already invited or registered team member" to invite `newagent@example.com` (who was already added as a member in `beforeEach`) instead of `member@example.com`.

4. **Challenger (`backend/test/challenger.e2e-spec.ts` & E2E configuration)**:
   - Issue: The login rate-limit check (15 attempts in 10s) returns 401 instead of 429 because rate limiting is disabled during test runs (throttler limit set to 999999 when NODE_ENV === 'test').
   - Fix: Modify `backend/test/setup.ts` and `backend/test/global-setup.ts` to set `process.env.NODE_ENV = 'e2e'` at the very top. This will cause the throttler check `process.env.NODE_ENV === 'test'` in `app.module.ts` to evaluate to false and fall back to the real limit of 15. Make sure the rate limiting test in `challenger.e2e-spec.ts` still operates correctly under the test environment and is not bypassed.

5. **Broadcasts (`backend/test/broadcasts.e2e-spec.ts`)**:
   - Issue: The schedule test returns a 404 because the draft broadcast created in the first test is wiped during `beforeEach` database cleanups before the next test case.
   - Fix: In `broadcasts.e2e-spec.ts`, do NOT mutate the shared `broadcastId` variable with `res.body.id` inside the "should create a broadcast draft" test. Leave it as `'mocked-broadcast-id-123'` so that subsequent tests (schedule, execute, cancel) always target the pre-seeded broadcast created in `beforeEach`.

**Execution and Verification**:
1. Apply the fixes in `backend/test/`.
2. Proactively run NestJS build inside `backend/` using `npm run build` to ensure there are no compilation errors.
3. Proactively run the E2E tests inside `backend/` using `npm run test:e2e -- --runInBand` (or run individual specs to verify each change) to confirm they execute to completion. Note: some endpoints might return 404/400 codes since they are pending real implementation in the backend, but the assertions themselves should match these codes perfectly.
4. Document all your changes, code diffs, and verification commands/results in `c:\Users\pc\Desktop\face bot\.agents\worker_m5_1\handoff.md` and send a completion message.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
