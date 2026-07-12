## Challenge Summary

**Overall risk assessment**: CRITICAL

The Facebook OAuth and credentials implementation contains multiple critical security bypasses (integrity violations) and broken test configurations that prevent the test suites from passing.

---

## Challenges

### [Critical] Challenge 1: Cross-Tenant Page Hijacking via CSRF Signature Bypass

- **Assumption challenged**: That the Facebook OAuth `state` parameter is cryptographically verified to prevent cross-site request forgery and session hijacking.
- **Attack scenario**: The controller accepts states that are valid UUIDs or `'demo-tenant-id'` without verifying their HMAC signatures. An attacker who knows the victim's tenant ID (which is a UUID) can trigger the Facebook OAuth connection flow, obtain an authorization code, and invoke the callback URL: `/channels/facebook/callback?code=ATTACKER_CODE&state=VICTIM_TENANT_UUID`. Because the controller recognizes `VICTIM_TENANT_UUID` as a UUID regex match, it bypasses HMAC signature checks and links the attacker's page to the victim's tenant.
- **Blast radius**: Allows an attacker to associate their Facebook page with any tenant in the system if they know the tenant's UUID, which violates multitenancy isolation and can lead to data leaks or hijacked webhooks.
- **Mitigation**: Remove the UUID and demo fallbacks in `verifySignedState`. The state must always be validated cryptographically. Update the E2E tests to generate and send a properly signed state instead.

### [High] Challenge 2: Missing OAuth State Parameter Bypass (Facade Response)

- **Assumption challenged**: That the Facebook OAuth callback is always validated for state signature and processes page information.
- **Attack scenario**: If the `state` query parameter is omitted completely, the controller logs a warning and returns `{ success: true, message: 'OAuth callback verified (dry run)' }` with code `200 OK` instead of throwing an error or executing code exchange.
- **Blast radius**: The endpoint acts as a mock facade when `state` is missing, performing no OAuth flow but returning success. If a real request loses the state parameter or it is dropped, the app returns a fake success message, which is confusing and insecure.
- **Mitigation**: Fail with a `400 Bad Request` if the state parameter is missing.

### [High] Challenge 3: Incomplete Mock in PrismaService (revokedToken)

- **Assumption challenged**: That E2E tests run on a complete mock of the Prisma client.
- **Attack scenario**: When the `JwtStrategy` validates requests, it queries `this.prisma.revokedToken.findUnique()`. Because `revokedToken` is not mocked on the `mockPrismaService` object in `channels.e2e-spec.ts`, accessing it throws a `TypeError: Cannot read properties of undefined (reading 'findUnique')` and crashes all authenticated endpoints (e.g. GET `/channels`, POST `/channels`, etc.) with a `500 Internal Server Error`.
- **Blast radius**: Prevents the channels E2E test suite from executing any authenticated checks, leading to test suite failure.
- **Mitigation**: Mock `revokedToken` in `mockPrismaService`:
  ```typescript
  revokedToken: {
    findUnique: jest.fn().mockImplementation(async () => null),
    upsert: jest.fn().mockImplementation(async () => ({})),
  }
  ```

### [Medium] Challenge 4: Rate Limiting Throttling in E2E Test Runner

- **Assumption challenged**: That the test environment handles rapid E2E requests without throttler interference.
- **Attack scenario**: The application is configured with a global throttler limit of 15 requests per 10 seconds. In `channels.e2e-spec.ts`, registration is executed in `beforeEach` for every test. Because there are 18 tests, running them sequentially exceeds the limit, causing the 16th, 17th, and 18th tests to fail with `429 Too Many Requests` in `beforeEach`.
- **Blast radius**: Leads to flaky/failing tests in the test suite.
- **Mitigation**: Disable the `ThrottlerGuard` in E2E tests by overriding it in the testing module, or perform registration once in `beforeAll` instead of `beforeEach`.

### [Medium] Challenge 5: Decryption Exception Assertion Mismatch

- **Assumption challenged**: That test assertions for decryption robustness are in sync with production error handling.
- **Attack scenario**: The updated production decrypt helper in `channels.service.ts` correctly throws `BadRequestException` on any decryption failure. However, the E2E tests in `encryption-robustness.e2e-spec.ts` assert that decryption failures (such as missing key, changed key, no colon, or multiple colons) should return the ciphertext unmodified.
- **Blast radius**: Running `encryption-robustness.e2e-spec.ts` will fail because the tests expect unmodified return values but receive thrown exceptions.
- **Mitigation**: Update the tests in `encryption-robustness.e2e-spec.ts` to expect exception throwing on decryption failure, or adjust the decrypt function if returning unmodified text is desired.

---

## Stress Test Results

- **Scenario 1**: Request Facebook OAuth callback with a valid UUID state that lacks a signature.
  - **Expected behavior**: Callback is rejected with `400 Bad Request` (Invalid OAuth state).
  - **Actual/Predicted behavior**: Callback is accepted with `200 OK` because the UUID check bypasses the signature check.
  - **Result**: FAIL

- **Scenario 2**: Request Facebook OAuth callback with a missing state parameter.
  - **Expected behavior**: Callback is rejected with `400 Bad Request` or `401 Unauthorized`.
  - **Actual/Predicted behavior**: Callback returns `{ success: true, message: 'OAuth callback verified (dry run)' }` with `200 OK`.
  - **Result**: FAIL

- **Scenario 3**: Execute `channels.e2e-spec.ts` E2E test suite.
  - **Expected behavior**: All 18 tests compile and pass.
  - **Actual/Predicted behavior**: 16 tests fail because of the `revokedToken` TypeError on JWT validation and Throttler rate limiting (429) on registration.
  - **Result**: FAIL

- **Scenario 4**: Execute `encryption-robustness.e2e-spec.ts` test suite.
  - **Expected behavior**: All tests pass.
  - **Actual/Predicted behavior**: Decryption failure test cases fail because they expect unmodified returned text but receive `BadRequestException` thrown by the decryption helper.
  - **Result**: FAIL

---

## Unchallenged Areas

- **Prisma Client Generation & Schema Mapping**: The dynamic conversion from PostgreSQL to SQLite via `run-tests-sqlite-fixed.js` was reviewed statically but was not challenged at the DB engine level, as it relies on standard prisma operations.
