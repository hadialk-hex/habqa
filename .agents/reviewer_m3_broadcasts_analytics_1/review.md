# Milestone 3 (Broadcasting & Analytics) Review Report

## Review Summary

**Verdict**: REQUEST_CHANGES

The implementation introduces key dashboard analytics enhancements and a complete broadcasts controller, service, and front-end management system. The styling fully conforms to the Dark Neon theme with zero purple/violet elements and uses custom toast/confirm dialogs correctly. However, the application currently fails to compile in both backend and frontend directories, and backend unit/E2E tests fail to pass.

---

## 🔍 Quality Review Findings

### [Critical] Finding 1: Backend Compilation Failure
- **What**: NestJS backend application fails to compile.
- **Where**:
  - `backend/src/subscribers/dto/subscribers.dto.ts` (Line 10)
  - `backend/src/subscribers/subscribers.service.ts` (Lines 20, 131)
  - `backend/src/webhooks/webhooks.service.ts` (Line 163)
- **Why**: The database schema uses the SQLite provider locally, which defines `tags` as a single `String` (due to SQLite array limitations), and enums like `PlatformType` are not present in the generated client. However, the TypeScript codebase:
  - Imports `PlatformType` from `@prisma/client`.
  - Assigns an array `uniqueTags` (`string[]`) to `tags` (`String`).
  - Calls `.forEach()` on `sub.tags` which is a string.
  - Assigns an empty array `[]` to `tags` in webhook receiver.
- **Suggestion**: Standardize type conversion by serializing tag arrays to comma-separated strings (or JSON stringified arrays) when using SQLite, and parse them back to array forms inside services. Remove the import of `PlatformType` and replace it with direct string literal checks.

### [Critical] Finding 2: Frontend Compilation Failure
- **What**: Next.js frontend application fails to compile.
- **Where**: `frontend/src/app/dashboard/subscribers/page.tsx` (Line 201)
- **Why**: The platform selection dropdown callback returns a value of type `string | null` (from the UI component library), but the state setter `setPlatform` expects a non-null string (`SetStateAction<string>`).
- **Suggestion**: Default the value to an empty string inside the setter: `onValueChange={(val) => { setPlatform(val || ""); setPage(1); }}`.

### [Major] Finding 3: Unit Test Failure (challenger.spec.ts)
- **What**: The unit test suite has a failure under "Subscribers Module".
- **Where**: `backend/src/challenger.spec.ts` (Line 186)
- **Why**: The test asserts that `prisma.subscriber.create` is called with a specific payload that does not include the `platform` field. However, `subscribers.service.ts` now passes `platform: dto.platform || null` to the prisma client call.
- **Suggestion**: Update `challenger.spec.ts` to expect `platform: null` in the mock assertion.

### [Major] Finding 4: E2E Test Suite Execution Failure
- **What**: End-to-end tests fail during database setup.
- **Where**: `backend/test/global-setup.ts` / Port configuration.
- **Why**: The E2E test runner attempts to stand up and connect to PostgreSQL on default port `5432`. However, port `5432` is reserved/locked locally (e.g. by WSL), and the active PostgreSQL instance runs on port `5433` (as documented in `STATUS.md`). This mismatch triggers a connection timeout (`P1001: Can't reach database server`).
- **Suggestion**: Update test database client settings or config to point to port `5433` if `5432` is blocked.

---

## 🎯 Verified Claims

- **Visual Theme Conformity** → Verified visually and via grep → **PASS** (Zero purple/violet elements found. All UI items use Cyan `#00e5ff` / Neon Teal `#0ff5d4` gradients and dark background `#0a0a0f`).
- **Custom Confirmation & Toast Dialogs** → Verified via file inspection in `broadcasts/page.tsx` → **PASS** (Uses custom `useToast` and `useConfirm` hooks instead of native `window.alert()` / `window.confirm()`).
- **Trend Percentage Calculations** → Verified in `dashboard.service.ts` → **PASS** (Logic checks for zero values and handles percentage changes correctly, rounding to two decimal places).
- **Date Filters** → Verified in `dashboard.service.ts` → **PASS** (Correct range parser and start/end limit validations preventing start date from being after end date).
- **Minutely Cron Scheduler** → Verified in `broadcasts.service.ts` → **PASS** (Uses `@Cron(CronExpression.EVERY_MINUTE)` with active NestJS scheduling module).

---

## 🕵️‍♂️ Adversarial Review (Critic)

**Overall Risk Assessment**: MEDIUM-HIGH (due to compile failure and scheduler edge cases)

### [High] Challenge 1: Infinite Cron Execution Loops on Failures
- **Assumption challenged**: The minutely cron execution (`handleScheduledBroadcasts`) assumes that broadcasts will run successfully and change status to `SENT`.
- **Attack scenario**: If a broadcast's execution fails (e.g. database locks, transient API client mock issues, or corrupt message payload), the cron catches the exception, but the broadcast's status remains `SCHEDULED`. On the next minute, the cron will select it again.
- **Blast radius**: If the error occurs after sending messages to some subscribers, retrying the broadcast will result in duplicate spam messages to the initial batch of subscribers. It also generates infinite log spam and CPU utilization.
- **Mitigation**: Update the broadcast's status to `FAILED` or increment a retry counter on error catch, and ignore it in subsequent cron runs if retries exceed a threshold.

### [Medium] Challenge 2: Substring Tag Matching Collisions
- **Assumption challenged**: The broadcast service filters targeted subscribers using `s.tags.includes(broadcast.segmentTarget)`.
- **Attack scenario**: Since `tags` was converted to a single `String` field to support SQLite, calling `.includes` performs a simple substring check. If subscriber A is tagged with `"vip-lead"` and subscriber B is tagged with `"vip"`, a broadcast targeted specifically to `"vip"` will match both subscribers.
- **Blast radius**: Misdirected broadcast campaigns targeting the wrong segments.
- **Mitigation**: Parse the tag string into a clean array before checking matches (e.g., `s.tags.split(',').map(t => t.trim()).includes(target)`).

---

## 🔍 Coverage Gaps & Unverified Items

- **WSL Database Connection Setup** — Not verified locally since WSL ports are locked by the host system.
- **Production PostgreSQL Behavior** — The SQLite transition was implemented for local debugging, leaving PostgreSQL-specific behaviors (like arrays) untested locally outside mock tests. Recommendation: run a full test pass in a dockerized PostgreSQL environment on port 5433 before milestone signoff.
