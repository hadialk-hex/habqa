# Verification Plan

This plan details the steps to empirically verify the Facebook OAuth and credentials changes in the codebase.

## Steps

1. **Verify Implementation Bypasses (Integrity Verification)**
   - Check `backend/src/channels/channels.controller.ts` for signature validation fallbacks:
     - Check line 73: `state === 'demo-tenant-id' || uuidRegex.test(state)`.
     - Check lines 81-84: Missing `state` parameter dry-run fallback.
   - **Verification**: Check if these fallbacks bypass HMAC verification, creating CSRF and authentication bypasses.

2. **Verify Decryption Exceptions**
   - Check `backend/src/channels/channels.service.ts` decrypt function:
     - Check lines 32-50: Verify that it throws `BadRequestException` on decryption failure, changed key, or wrong format.
   - Check `backend/test/encryption-robustness.e2e-spec.ts` expectations:
     - Check lines 108, 128, 149, 155: Verify if they assert that decryption failures swallow exceptions and return the ciphertext unmodified.
   - **Verification**: Confirm that because the service throws while the tests expect swallowed errors, `encryption-robustness.e2e-spec.ts` is guaranteed to fail.

3. **Verify E2E Test Mock Completeness**
   - Check `backend/test/channels.e2e-spec.ts` for Prisma service mocking:
     - Verify if `mockPrismaService` lacks `revokedToken` model definition.
   - Check `backend/src/auth/strategies/jwt.strategy.ts`:
     - Verify if `JwtStrategy` queries `this.prisma.revokedToken.findUnique()` for every authenticated request.
   - **Verification**: Confirm that calling authenticated endpoints in `channels.e2e-spec.ts` throws `TypeError: Cannot read properties of undefined (reading 'findUnique')`.

4. **Verify Rate Limiting (Throttler) in E2E Tests**
   - Check `backend/src/app.module.ts` for rate limit configurations:
     - Verify limit of 15 requests per 10 seconds.
   - Check `backend/test/channels.e2e-spec.ts`:
     - Verify if `beforeEach` registers a new user via `/auth/register` for all 18 test cases.
   - **Verification**: Confirm that executing 18 tests sequentially will trigger a `429 Too Many Requests` error after 15 requests, causing subsequent tests to fail.

5. **Generate Verification Reports**
   - Record findings in `handoff.md` with:
     - Proposed test command.
     - Statically and dynamically traced outputs.
     - Logic chain from observations to conclusions.
