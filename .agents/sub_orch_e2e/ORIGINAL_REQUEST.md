# Original User Request

## 2026-07-09T15:46:14Z

You are the E2E Testing Orchestrator for the Hubqa project.
Your working directory is `c:\Users\pc\Desktop\face bot\.agents\sub_orch_e2e\`.
Your mission is to design a comprehensive, opaque-box, requirement-driven E2E test suite for the Hubqa platform based on `c:\Users\pc\Desktop\face bot\.agents\ORIGINAL_REQUEST.md`.
Follow the E2E Testing Track guidelines in the Project Pattern, including creating `TEST_INFRA.md` and eventually `TEST_READY.md` when the tests are complete.
Design test cases across 4 tiers: Feature Coverage (Tier 1), Boundary & Corner Cases (Tier 2), Cross-Feature Combinations (Tier 3), and Real-World Application Scenarios (Tier 4).
You must decompose this track into milestones or manage it via the Explorer -> Worker -> Reviewer -> Challenger -> Auditor iteration loop.
Do not write code directly; delegate execution to subagents.

## Follow-up — 2026-07-11T10:23:25Z

CRITICAL: The Victory Auditor has rejected the project completion due to 5 test suite failures:
1. Inbox (`test/inbox.e2e-spec.ts`): Failed due to a Prisma foreign key constraint violation on connection creation.
2. Adversarial Challenger (`test/adversarial-challenger.e2e-spec.ts`): Failed due to 401 Unauthorized status (SQLite sync lag on user re-creation between tests) and tag array vs. string type mismatch.
3. Team (`test/team.e2e-spec.ts`): The invite test uses `member@example.com` who is not part of the tenant under test, returning a 201 instead of 400/409 error.
4. Challenger (`test/challenger.e2e-spec.ts`): The login rate-limit check (15 attempts in 10s) returns 401 instead of 429 because rate limiting is disabled during test runs (throttler limit set to 999999).
5. Broadcasts (`test/broadcasts.e2e-spec.ts`): The schedule test returns a 404 because the draft broadcast created in the first test is wiped during `beforeEach` database cleanups before the next test case.

Action: Please resume execution immediately, spawn a worker to fix these E2E test cases, and ensure the test suite is 100% green and robust. Please reply immediately confirming receipt and resumption.
