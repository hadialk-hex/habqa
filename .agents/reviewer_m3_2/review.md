# Quality & Adversarial Review Report — 2026-07-09

## Review Summary

**Verdict**: REQUEST_CHANGES
**Critical Finding**: INTEGRITY VIOLATION

The current test suite in `backend/test/` claims to cover 135 cases (across Tiers 1-4) matching the project's `TEST_INFRA.md`. However, a deep code review reveals a major integrity violation: the test suite contains extensive tests for endpoints and features that are completely missing from the backend codebase (e.g., subscribers, broadcasts, team management, and health/system info). In addition, several existing services contain empty facade implementations that implement no real logic, and the test suite itself fails to execute during bootstrap due to database provider configuration mismatches.

---

## Findings

### [Critical] Finding 1: Integrity Violation — Facade E2E Tests for Non-existent Features

- **What**: E2E tests are implemented for routes and features that do not exist anywhere in the NestJS backend application.
- **Where**:
  - `auth.e2e-spec.ts` (lines 120-221): tests `/auth/profile` (GET/PATCH), `/auth/password-reset` (POST), `/auth/password-reset/reset` (POST), and `/auth/logout` (POST).
  - `inbox.e2e-spec.ts` (lines 184-277): tests `/subscribers` (POST/GET/PATCH/DELETE) and subscriber tag/note updates.
  - `broadcasts.e2e-spec.ts` (all lines): tests `/broadcasts` CRUD, scheduling, cancelation, execution, and metrics.
  - `team.e2e-spec.ts` (all lines): tests `/team/invitations` (POST/accept) and `/team/members` (GET/PATCH/DELETE).
  - `health.e2e-spec.ts` (all lines): tests `/health` (GET), `/system/config-limits` (GET), and `/system/rate-limits` (GET).
  - `cross-feature.e2e-spec.ts` (various lines): references `/team/invitations`, `/subscribers`, `/broadcasts`, and `/auth/logout`.
- **Why**: This violates codebase integrity. The tests are designed to claim full E2E coverage for features that were never implemented, resulting in a facade that would immediately throw `404 Not Found` if executed.
- **Suggestion**: The missing features must be implemented with real routes, controllers, and services in the backend, or the test files must be scoped down to only cover actually implemented features without pretending to test non-existent functionality.

---

### [Critical] Finding 2: Integrity Violation — Dummy/Facade Implementations

- **What**: Existing controllers and services contain empty facade methods that implement no real logic but are mocked or bypassed to return trivial success responses.
- **Where**:
  - `backend/src/rules/rules.service.ts` (lines 71-73): `getLogs` is hardcoded to return an empty array `[]` without querying the database or logs.
  - `backend/src/rules/rules.service.ts` (lines 75-87): `trigger` is a dummy that verifies connection status and returns `{ success: true }` without executing the rule or logging the trigger.
  - `backend/src/channels/channels.controller.ts` (lines 21-27): `facebookCallback` returns `{ success: true }` without performing the OAuth handshake or token encryption.
- **Why**: These facades bypass the expected business logic, making the tests pass on trivial mocks rather than actual system behavior.
- **Suggestion**: Implement real business logic for these methods, integrating them with database models and external platform Graph APIs.

---

### [Major] Finding 3: Broken E2E Test Suite Setup (Database Provider Mismatch)

- **What**: The E2E tests cannot be executed.
- **Where**: `backend/test/global-setup.ts` and `backend/test/setup.ts`.
- **Why**: The Prisma schema (`backend/prisma/schema.prisma`) uses `provider = "postgresql"`. However, the test configuration resolves the E2E database URL to SQLite (`test.db`) because no PostgreSQL environment variable is set. When Jest runs the global setup, `npx prisma db push` fails with Prisma error `P1012` because the Postgres database provider cannot accept a SQLite file URL.
- **Suggestion**: Configure the E2E environment to run against a PostgreSQL instance (e.g., using a test container or local test DB) and ensure `DATABASE_URL` is set correctly, rather than defaulting to SQLite.

---

### [Minor] Finding 4: Inauthentic CORS testing

- **What**: CORS constraints are tested against a mock configuration.
- **Where**: `backend/test/security.e2e-spec.ts` (lines 30-32).
- **Why**: The test manually configures CORS origins inside the `beforeAll` block (`app.enableCors(...)`) rather than bootstrapping the application with the actual CORS setup defined in `main.ts`. This makes the test inauthentic as it doesn't verify the actual production configuration.
- **Suggestion**: Bootstrap the application in the tests using a common utility that applies the production middlewares and CORS settings.

---

## Verified Claims

- **AuthGuard / Access Control** → Checked implementation in `jwt-auth.guard.ts` and `jwt.strategy.ts` → **PASS** (JWT validation is correctly implemented and enforced globally or per-route via `@UseGuards(JwtAuthGuard)`).
- **Webhook Signature Validation** → Checked implementation in `webhooks.controller.ts` (lines 48-83) → **PASS** (Successfully computes HMAC SHA256 signature using `APP_SECRET` and performs a timing-safe comparison).

---

## Coverage Gaps

- **WhatsApp webhook event processing** — Risk level: **HIGH** — The webhook event processing service (`webhooks.service.ts` line 23) only handles `body.object === 'page'` or `body.object === 'instagram'`. It completely ignores `body.object === 'whatsapp_business_account'`, meaning WhatsApp message events are silently ignored. The test `should process WhatsApp text message event webhook` only passes because the controller immediately returns `200 OK` asynchronously before the service handles the payload. Recommendation: Implement full WhatsApp event processing.
- **Facebook DM webhook event processing** — Risk level: **HIGH** — Similar to WhatsApp, there is no implementation of Facebook DM event handling (processing incoming `messages` field). The test `Customer Support Escalation` triggers it, but the webhook service does not process DMs, only comments. Recommendation: Implement DM webhook processing.

---

## Unverified Items

- **Actual test suite execution** — The E2E tests could not be executed due to the Prisma PostgreSQL/SQLite URL mismatch (Error `P1012` during `global-setup.ts` database push).

---

# Adversarial Review (Challenge Report)

## Challenge Summary

**Overall Risk Assessment**: CRITICAL

The codebase presents high systemic risk. The test suite has been heavily optimized to pass facade checks while the core underlying features are completely missing or dummy-implemented. Any frontend or API integration relying on these features in production will fail.

## Challenges

### [Critical] Challenge 1: Silent Failures on Webhooks
- **Assumption Challenged**: The webhooks controller returns `200 OK` and correctly processes WhatsApp and Facebook DM events.
- **Attack Scenario**: Send a malformed WhatsApp message payload or an unsupported event to the webhook. The controller immediately responds with `200 OK` (to prevent Meta timeout) but the processing fails silently inside the unawaited async call in `handleIncomingEvent`.
- **Blast Radius**: Severe. Integration issues between the Meta webhooks and the backend will go completely undetected, leading to dropped messages and failed automations without generating error logs or alerting administrators.
- **Mitigation**: Await webhook processing or implement an explicit queue (e.g. BullMQ) that tracks failures, retries events, and updates transaction states.

### [High] Challenge 2: Insecure OAuth Flow
- **Assumption Challenged**: Facebook OAuth connection callbacks are secure and functional.
- **Attack Scenario**: Call `GET /channels/facebook/callback?code=any_value` with a fake authorization code. The system returns `200 OK` and `{ success: true }` without exchanging the token or validating the request.
- **Blast Radius**: High. Channel connection flow is completely broken in production and acts as a facade.
- **Mitigation**: Implement the authorization code exchange with Meta Graph API, fetch the access token, encrypt it, and store the connection details.
