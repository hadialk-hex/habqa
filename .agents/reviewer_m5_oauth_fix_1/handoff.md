# Handoff Report

## 1. Observation

During the review of Facebook OAuth and credentials changes in the following files:
- `backend/src/channels/channels.service.ts`
- `backend/src/channels/channels.controller.ts`
- `backend/test/channels.e2e-spec.ts`

The following observations were made:

### Observation A: CSRF State Signature Bypass
In `backend/src/channels/channels.controller.ts`, lines 70-78:
```typescript
      let tenantId = this.verifySignedState(state);
      if (!tenantId) {
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        if (state === 'demo-tenant-id' || uuidRegex.test(state)) {
          tenantId = state;
        } else {
          throw new BadRequestException('Invalid OAuth state');
        }
      }
```
If the HMAC signature verification fails (or state is not signed), the code falls back to checking if the state string equals `'demo-tenant-id'` or matches a UUID pattern. If so, it accepts it as the `tenantId` without verifying the cryptographic signature.

### Observation B: OAuth Callback State Parameter Facade
In `backend/src/channels/channels.controller.ts`, lines 81-84:
```typescript
    } else {
      console.warn('Facebook callback received without state parameter (dry run)');
      return { success: true, message: 'OAuth callback verified (dry run)' };
    }
```
If the `state` parameter is completely omitted, the controller returns a mock success response `{ success: true, message: 'OAuth callback verified (dry run)' }` instead of throwing an error.

### Observation C: E2E Test Suite Validation of Bypasses
In `backend/test/channels.e2e-spec.ts`, lines 581-615:
```typescript
    it('should succeed with 200 when state is a valid UUID (fallback)', async () => {
      // ...
      const validUUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      await request(app.getHttpServer())
        .get('/channels/facebook/callback')
        .query({ code: 'valid_code', state: validUUID })
        .expect(200);
    });
```
And lines 619-624:
```typescript
    it('should handle Facebook OAuth callback successfully (Tier 1)', async () => {
      await request(app.getHttpServer())
        .get('/channels/facebook/callback')
        .query({ code: 'valid_facebook_auth_code' })
        .expect(200);
    });
```
The test suite explicitly expects that an unsigned UUID (fallback) or a callback missing the `state` parameter entirely will return `200 OK`.

### Observation D: Cross-Tenant Connection Hijacking Protection
In `backend/src/channels/channels.service.ts`, lines 98-103 (`addConnection`) and lines 155-159 (`upsertConnection`):
```typescript
    if (existing) {
      if (existing.tenantId !== tenantId) {
        throw new ConflictException('Channel is already connected to another tenant');
      }
      throw new ConflictException('Channel is already connected');
    }
```
If a platform connection already exists with the same platform and platform ID but has a different tenant ID, it throws a `ConflictException`.

### Observation E: E2E Test Suite Execution Failures
Running the test suite using `npm run test:e2e` in `backend` directory results in test failures.
Error 1: JWT strategy database error:
```
[Nest] 28784  - 07/11/2026, 1:26:43 PM   ERROR [ExceptionsHandler] TypeError: Cannot read properties of undefined (reading 'findUnique')
    at JwtStrategy.validate (C:\Users\pc\Desktop\face bot\backend\src\auth\strategies\jwt.strategy.ts:28:54)
```
Error 2: Rate limit throttling error:
```
expected 201 "Created", got 429 "Too Many Requests"
      279 |         tenantName: 'Channel Tenant',
      280 |       })
    > 281 |       .expect(201);
```

---

## 2. Logic Chain

1. **CSRF State Signature Bypass Vulnerability**: 
   - Based on **Observation A**, the controller accepts state parameters that match UUIDs or the string `'demo-tenant-id'` without verifying their HMAC signatures.
   - Tenant IDs in this application are UUIDs (as seen in the database schema and E2E logs).
   - This means an attacker can trigger the Facebook OAuth callback with a hijacked authorization code (or an attacker-controlled page authorization) and supply the victim's tenant ID as the `state` parameter.
   - The application will parse the state, recognize it as a UUID, bypass HMAC verification, and connect the page to the victim's tenant, creating a classic CSRF state bypass.
   - Therefore, the CSRF signature validation is not fully resolved and contains a major security vulnerability.

2. **Integrity Violation (Facade/Shortcuts)**:
   - Based on **Observation A and C**, the signature validation bypass was deliberately implemented to make the E2E tests (`should succeed with 200 when state is a valid UUID (fallback)`) pass without needing to sign the state using HMAC.
   - Based on **Observation B and C**, the "dry run" fallback for a missing `state` parameter is a facade implementation that performs no actual OAuth logic and immediately returns `200 OK` solely to satisfy the test (`should handle Facebook OAuth callback successfully (Tier 1)`).
   - Therefore, these constitute **integrity violations (facade/hardcoded shortcuts)**.

3. **Cross-Tenant Connection Hijacking**:
   - Based on **Observation D**, the checks in `addConnection` and `upsertConnection` prevent linking an already connected page to another tenant by throwing a `ConflictException`.
   - This effectively mitigates the connection hijacking vulnerability.

4. **E2E Test Suite Failures**:
   - Based on **Observation E**, the E2E tests fail because:
     - The global `mockPrismaService` in `backend/test/channels.e2e-spec.ts` does not mock the `revokedToken` model model, which is invoked by `JwtStrategy.validate` on every authenticated request.
     - The `ThrottlerGuard` is active on `/auth/register`, and calling it in the `beforeEach` block of every test exceeds the rate limit, returning `429 Too Many Requests`.

---

## 3. Caveats

- We assumed that `process.env.APP_SECRET` is used for signing the OAuth state in the controller, which must be consistent in production. If `APP_SECRET` is undefined, it defaults to `'default-app-secret-key'`.
- We only reviewed the Facebook OAuth channels module and its interaction with JWT strategy/Prisma; other endpoints and authentication methods were not fully verified.

---

## 4. Conclusion

The updated Facebook OAuth and credentials changes contain **Integrity Violations** and **Security Vulnerabilities**:
- **VERDICT**: **REQUEST_CHANGES** (Critical Finding: **INTEGRITY VIOLATION**)
- **CSRF State Signature Validation**: Not resolved. There is a signature bypass backdoor for UUID-like states and a facade implementation for callbacks missing the state parameter entirely.
- **Cross-Tenant Connection Hijacking**: Successfully resolved in the service layer using tenant ID match checks.
- **E2E Test Suite**: Currently failing due to rate-limiting (429) on registration and a missing mock for `revokedToken` in `mockPrismaService`.

---

## 5. Verification Method

To verify these findings:
1. Check the controller file `backend/src/channels/channels.controller.ts` at line 70-78 to verify the UUID bypass of `verifySignedState`.
2. Check `backend/src/channels/channels.controller.ts` at line 81-84 to verify the "dry run" fallback.
3. Run E2E tests using:
   ```powershell
   cd backend
   npm run test:e2e
   ```
   Inspect the logs to see the `429 Too Many Requests` and `TypeError: Cannot read properties of undefined (reading 'findUnique')` errors.

---

# Quality Review Report

## Review Summary

**Verdict**: REQUEST_CHANGES

## Findings

### [Critical] Finding 1: CSRF State Signature Validation Bypass (Integrity Violation)
- **What**: The OAuth callback accepts unsigned UUIDs or `'demo-tenant-id'` as states.
- **Where**: `backend/src/channels/channels.controller.ts`, lines 70-78.
- **Why**: Anyone can craft a state parameter matching the target's tenant UUID, bypassing the HMAC signature check completely. This defeats CSRF protection.
- **Suggestion**: Remove the bypass fallback block. The state must always be signature-verified. Update E2E tests so they always generate and send a properly signed state.

### [Critical] Finding 2: Facade Callback Success on Missing State (Integrity Violation)
- **What**: The callback returns `200 OK` on missing `state` parameter (as "dry run").
- **Where**: `backend/src/channels/channels.controller.ts`, lines 81-84.
- **Why**: It is a dummy facade returning a success message to satisfy a test without implementing any actual logic.
- **Suggestion**: Require a valid signed state on all callback invocations; return `400 Bad Request` if state is missing. Update the E2E test to supply a valid state.

### [Major] Finding 3: E2E Test Suite Failures
- **What**: E2E tests fail to run to completion.
- **Where**: `backend/test/channels.e2e-spec.ts`.
- **Why**:
  1. `mockPrismaService` lacks the `revokedToken` mock model required by `JwtStrategy.validate`.
  2. Registering users in `beforeEach` triggers the NestJS throttler/rate limiter (429).
- **Suggestion**: 
  1. Add a mock for `revokedToken.findUnique` returning `null` (or checking a mock array) in `mockPrismaService`.
  2. Override or disable the `ThrottlerGuard` during testing, or register a single user in `beforeAll` instead of `beforeEach` to avoid triggering the rate limiter.

## Verified Claims

- Cross-tenant hijacking prevention → verified via inspection of `channels.service.ts` checking tenantId and E2E test `should prevent connecting a page that is already connected to another tenant` → PASS
- Secure credentials storage → verified via inspection of AES-256-CBC encryption in `channels.service.ts` and token masking → PASS

---

# Challenge Report (Adversarial Review)

## Challenge Summary

**Overall risk assessment**: CRITICAL

## Challenges

### [Critical] Challenge 1: Cross-tenant Hijacking through CSRF Bypass
- **Assumption challenged**: That OAuth state validation is secure.
- **Attack scenario**: An attacker knows the victim's tenant ID (which is a public/semi-public UUID in many multitenant platforms) or matches it. They initiate the Facebook OAuth connection flow, obtain an authorization code, and construct a callback URL: `http://localhost:3000/channels/facebook/callback?code=ATTACKER_CODE&state=VICTIM_TENANT_UUID`.
- **Blast radius**: Since the victim's tenant ID is a valid UUID, the controller bypasses HMAC verification and registers the attacker's Facebook page under the victim's tenant connection.
- **Mitigation**: Completely remove the UUID regex fallback in `verifySignedState`.

### [High] Challenge 2: E2E Mocking Integrity Out-of-Sync
- **Assumption challenged**: That E2E tests run on a complete mock of `PrismaService`.
- **Attack scenario/Failure mode**: The implementation added a token revocation check in `JwtStrategy` querying `this.prisma.revokedToken`. Because the E2E tests mocked `PrismaService` manually instead of using a real database setup or a fully generated Prisma client mock, the test suite broke as soon as the strategy was updated.
- **Mitigation**: Mock `revokedToken` in `mockPrismaService` or use the SQLite test database directly without overriding `PrismaService` with a hand-rolled mock.
