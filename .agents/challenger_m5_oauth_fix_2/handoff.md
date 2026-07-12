# Handoff Report: Credentials & OAuth State Robustness Verification

## 1. Observation

### Code Paths & Implementation
- **Credentials Decryption**: Located in `backend/src/channels/channels.service.ts` (lines 32-50):
  ```typescript
  function decrypt(
    encryptedText: string | null | undefined,
  ): string | null | undefined {
    if (!encryptedText) return encryptedText;
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new BadRequestException('Malformed encrypted token');
    }
    try {
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new BadRequestException('Decryption failed: ' + error.message);
    }
  }
  ```
- **OAuth Callback / State Verification**: Located in `backend/src/channels/channels.controller.ts` (lines 30-47) and `backend/src/channels/channels.service.ts` (lines 305-325).
  `facebookCallback` in `channels.controller.ts`:
  ```typescript
  @Get('facebook/callback')
  async facebookCallback(
    @Query('code') code: string,
    @Query('state') state?: string,
  ) {
    if (!code) {
      throw new BadRequestException('Code is required');
    }
    if (!state) {
      throw new BadRequestException('Invalid state parameter');
    }
    const tenantId = this.channelsService.verifyOAuthState(state);
    if (!tenantId) {
      throw new BadRequestException('Invalid state parameter');
    }
    await this.channelsService.handleFacebookCallback(tenantId, code);
    return { success: true };
  }
  ```
  `verifyOAuthState` in `channels.service.ts`:
  ```typescript
  verifyOAuthState(state: string): string | null {
    if (!state) return null;
    const parts = state.split('.');
    if (parts.length !== 2) return null;
    const [tenantId, sig] = parts;
    const secret = this.configService.get<string>('APP_SECRET') || 'default-app-secret-key';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(tenantId);
    const expectedSig = hmac.digest('hex');
    try {
      const bufSig = Buffer.from(sig);
      const bufExpected = Buffer.from(expectedSig);
      if (bufSig.length === bufExpected.length && crypto.timingSafeEqual(bufSig, bufExpected)) {
        return tenantId;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }
  ```

### Empirical Test Execution Output
We executed a custom test suite `backend/test/challenger-emp.e2e-spec.ts` using the command:
`npx jest --config ./test/jest-e2e.json test/challenger-emp.e2e-spec.ts`

The test suite output is:
```text
PASS test/challenger-emp.e2e-spec.ts
  Empirical Verification: Credentials & State Signature
    Credentials Decryption Robustness
      √ throws error when ciphertext is malformed (no colon) (18 ms)
      √ throws error when ciphertext has multiple colons (2 ms)
      √ throws error when ENCRYPTION_KEY is missing during decryption (1 ms)
      √ throws error when WRONG key is used during decryption (2 ms)
    OAuth State Signature Verification
      √ verifies correct state signature (1 ms)
      √ rejects forged state signature format (1 ms)
      √ rejects invalid state parameter format
      √ successfully rejects raw UUID state parameter (4 ms)
      √ successfully rejects demo-tenant-id state parameter (1 ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
```

### Issues/Failures Found
1. **Broken Assertions in `test/encryption-robustness.e2e-spec.ts`**:
   The E2E tests in `test/encryption-robustness.e2e-spec.ts` incorrectly assert that `getDecryptedAccessToken` should silently return the unmodified input on decryption failure. Specifically:
   - `should silently return ciphertext on decryption failure if ENCRYPTION_KEY is missing`
   - `should silently return ciphertext on decryption failure if the key changes`
   - `should silently return unmodified text if the ciphertext does not contain a colon`
   - `should silently return unmodified text if the ciphertext has multiple colons`
   All of these fail because the production code securely throws a `BadRequestException` on decryption failure, rather than silently returning raw values.
   
2. **Missing property `revokedToken` in mock `PrismaService` in `test/channels.e2e-spec.ts`**:
   The E2E tests in `test/channels.e2e-spec.ts` fail (yielding 500 Internal Server Error) during `JwtStrategy.validate` because the mock `PrismaService` lacks the `revokedToken` property, throwing:
   `TypeError: Cannot read properties of undefined (reading 'findUnique') at JwtStrategy.validate`

---

## 2. Logic Chain

1. **Credentials Decryption Robustness**:
   - The decrypt helper splits the ciphertext by `:`. If the size is not exactly 2, it throws `BadRequestException('Malformed encrypted token')`.
   - If the key is changed or wrong, block parsing or padding checks fail inside `crypto.createDecipheriv` update/final methods, throwing an error caught by the `try-catch` block which explicitly throws `BadRequestException('Decryption failed: ' + error.message)`.
   - This validates that credential decryption is robust and does not leak or silently propagate bad ciphertext or wrong keys.

2. **OAuth State Signature Security**:
   - `verifyOAuthState` verifies that the state is structured as `tenantId.signature`.
   - It computes the expected signature using HMAC-SHA256 with `APP_SECRET` and performs a constant-time comparison via `crypto.timingSafeEqual`.
   - In the corrected codebase, the controller `facebookCallback` enforces `verifyOAuthState` as the sole verification path. Raw/unsigned states such as `demo-tenant-id` or raw UUIDs do not pass `verifyOAuthState` (which expects a signature suffix) and are rejected with a `403/400 BadRequestException`.
   - Thus, forged state signature values and raw UUID states are rejected, successfully mitigating CSRF bypasses.

---

## 3. Caveats

- We assumed that the NestJS environment uses the default `APP_SECRET` and `ENCRYPTION_KEY` configuration.
- We did not perform fuzzing of HMAC inputs beyond standard string format checking.
- The sqlite lock issues on Windows during E2E database sync required adding a try-catch to the `prisma generate` step in E2E setup, which may need to be reverted/configured properly for CI environments.

---

## 4. Conclusion

- **Decryption Robustness**: Decryption is highly robust. It securely throws `BadRequestException` when presented with bad ciphertext, a changed/wrong encryption key, or missing encryption configuration.
- **State Signature Robustness**: The OAuth state signature verification logic has been fixed and successfully rejects forged state values, raw UUIDs, and the raw `demo-tenant-id` string without bypass backdoors.
- **Action Required**: The test files `test/encryption-robustness.e2e-spec.ts` (unmodified return expectations) and `test/channels.e2e-spec.ts` (mock prisma definition) must be updated to align with the correct/updated implementation code.

---

## 5. Verification Method

To verify these findings independently, run:
```bash
cd backend
npx jest --config ./test/jest-e2e.json test/challenger-emp.e2e-spec.ts
```
The test suite contains 9 test cases covering:
1. Bad ciphertext formats (no colon, multiple colons) -> expecting exception.
2. Wrong key/missing key during decryption -> expecting exception.
3. Valid state verification -> expecting success.
4. Forged state signatures -> expecting reject.
5. Raw UUID and demo-tenant-id states -> expecting reject.
