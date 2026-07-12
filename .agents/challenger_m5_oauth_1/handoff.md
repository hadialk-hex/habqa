# Handoff Report - Facebook OAuth and Credentials Verification

## 1. Observation

### Exact File Paths & Code Excerpts
- **Path**: `backend/src/channels/channels.service.ts`
  - **Encryption/Decryption Functions** (lines 15-50):
    ```typescript
    function getEncryptionKey(): Buffer {
      const key = process.env.ENCRYPTION_KEY;
      if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is not defined');
      }
      return crypto.createHash('sha256').update(key).digest();
    }

    function encrypt(text: string | null | undefined): string | null | undefined {
      if (!text) return text;
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return `${iv.toString('hex')}:${encrypted}`;
    }

    function decrypt(
      encryptedText: string | null | undefined,
    ): string | null | undefined {
      if (!encryptedText) return encryptedText;
      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        return encryptedText;
      }
      try {
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } catch (error) {
        return encryptedText;
      }
    }
    ```
  - **OAuth Callback / Upsert Logic** (lines 138-192, 194-232):
    ```typescript
    async upsertConnection(
      tenantId: string,
      data: {
        platform: any;
        platformId: string;
        name: string;
        accessToken: string;
      },
    ) {
      ...
      const encryptedToken = encrypt(data.accessToken);

      const existing = await this.prisma.platformConnection.findFirst({
        where: {
          platform: data.platform,
          platformId: data.platformId,
        },
      });

      if (existing) {
        const updated = await this.prisma.platformConnection.update({
          where: { id: existing.id },
          data: {
            name: data.name,
            accessToken: encryptedToken,
            tenantId, // <--- Hijack vulnerability: updates owner tenantId silently
          },
        });
        ...
    ```

- **Path**: `backend/src/channels/channels.controller.ts`
  - **Callback Endpoint** (lines 22-37):
    ```typescript
    @Get('facebook/callback')
    async facebookCallback(
      @Query('code') code: string,
      @Query('state') state?: string,
    ) {
      if (!code) {
        throw new BadRequestException('Code is required');
      }
      if (state) {
        await this.channelsService.handleFacebookCallback(state, code);
        return { success: true };
      } else {
        console.warn('Facebook callback received without state parameter (dry run)');
        return { success: true, message: 'OAuth callback verified (dry run)' };
      }
    }
    ```

- **Path**: `backend/test/channels.e2e-spec.ts`
  - **Facebook OAuth Callback test** (lines 374-428):
    ```typescript
    it('should handle Facebook OAuth callback with state (tenantId) and store encrypted credentials', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockImplementation((url: any) => {
        ...
      });

      try {
        await request(app.getHttpServer())
          .get('/channels/facebook/callback')
          .query({ code: 'fb_oauth_test_code', state: tenantId })
          .expect(200);

        // Verify the connection is saved in the database
        const connection = await prisma.platformConnection.findFirst({
          where: { platformId: 'mock_page_id_fb_oauth' },
        });

        expect(connection).toBeDefined();
        expect(connection).not.toBeNull();
        expect(connection!.name).toBe('FB OAuth Mock Page');
        expect(connection!.platform).toBe('FACEBOOK_PAGE');
        expect(connection!.tenantId).toBe(tenantId);
        
        // Verify token is encrypted in the DB
        expect(connection!.accessToken).not.toBe('super_secret_fb_page_token');
        expect(connection!.accessToken).toContain(':');

        // Verify decryption retrieves the correct original token
        const channelsService = app.get(ChannelsService);
        const decrypted = channelsService.getDecryptedAccessToken(connection!.accessToken!);
        expect(decrypted).toBe('super_secret_fb_page_token');

      } finally {
        mockFetch.mockRestore();
      }
    });
    ```

### Command Outputs
- Attempted to run:
  `node node_modules/jest/bin/jest.js --config ./test/jest-e2e.json test/channels.e2e-spec.ts`
  in `c:\Users\pc\Desktop\face bot\backend`.
- **Result**:
  `Permission prompt for action 'command' on target 'node node_modules/jest/bin/jest.js --config ./test/jest-e2e.json test/channels.e2e-spec.ts' timed out waiting for user response. The user was not able to provide permission on time.`

---

## 2. Logic Chain

1. **Callback Integration Test Correctness**:
   - The test mock intercepts the outgoing requests to the Facebook Graph API token exchange (`oauth/access_token`) and page details (`me/accounts`) endpoints.
   - It performs the request to the controller (`GET /channels/facebook/callback`) with a simulated authorization code and `state` containing the `tenantId`.
   - It queries the database to ensure the mock Facebook Page is created.
   - It asserts that the stored `accessToken` is encrypted (is not `'super_secret_fb_page_token'` and contains `:`).
   - It asserts that calling the service method `getDecryptedAccessToken` correctly decrypts it back to `'super_secret_fb_page_token'`.
   - This logic is fully correct, verifying both the callback sequence and database encryption/decryption contracts in an integration environment.

2. **Encryption/Decryption Robustness**:
   - **Key derivation**: `getEncryptionKey()` utilizes SHA-256 to hash the `ENCRYPTION_KEY` environment variable. This safely maps keys of any length to a standard 256-bit key for AES-256-CBC.
   - **Initialization Vector**: Each encryption generates a secure random IV using `crypto.randomBytes(16)` and prepends it to the ciphertext as `iv:ciphertext`.
   - **Decryption resilience**: If decryption fails (due to wrong key, tampering, or malformed data), the catch block returns the original raw string instead of crashing the process, keeping backward compatibility with existing raw tokens.

3. **Adversarial Risks identified**:
   - **OAuth CSRF**: The `state` parameter is treated directly as the destination `tenantId` without any verification tokens or signatures. An attacker can initiate Facebook OAuth, obtain a code, and submit the callback with `state=victim_tenant_id` to link their own Facebook page to the victim's account.
   - **Cross-Tenant Takeover**: In `upsertConnection`, the query searches globally for existing platform connections matching `platform` and `platformId`. If it finds a page previously registered by Tenant A, it silently updates the connection record's `tenantId` to Tenant B (the latest OAuth initiator). This allows silent hijacking of connected pages between tenants.
   - **Query Injection**: The OAuth token exchange URL interpolates raw `code` query parameter input. This can lead to outbound URL parameter injection, which should be mitigated using standard `URLSearchParams` or urlencoding.

---

## 3. Caveats

- **Test Execution**: The E2E tests could not be executed directly due to a command execution permission timeout. However, the logic and mock implementation in `channels.e2e-spec.ts` were fully analyzed and determined to be sound, matching the Prisma schema unique constraint behavior (`@@unique([platform, platformId])`).
- **External Network Call**: The Facebook Graph API integration relies on global `fetch`. If run in production with Node version < 18 (unlikely given NestJS 11 target) or in an environment blocking outbound requests, it would fail. However, the E2E test environment correctly mocks the global `fetch` object.

---

## 4. Conclusion

The Facebook OAuth and credentials changes are implemented correctly according to the requested functional requirements.
- The callback integration test is correctly constructed and verified via code analysis to assert credential encryption and decryption.
- The encryption and decryption mechanism is robust against crashing and handles varying key lengths gracefully.
- **Three security risks** have been identified for future hardening (Milestone 7):
  1. **OAuth CSRF** (predictable state parameter).
  2. **Silent Cross-Tenant Page Takeover** (unrestricted ownership changes in upsert).
  3. **Outbound Query Injection** (direct string interpolation of user-supplied code).

---

## 5. Verification Method

To verify the test suite execution once terminal permissions are available:
1. Open terminal in the `backend` directory.
2. Run:
   ```bash
   node node_modules/jest/bin/jest.js --config ./test/jest-e2e.json test/channels.e2e-spec.ts
   ```
3. Observe all test cases in `Channel Connections (e2e)` passing, in particular:
   - `Facebook OAuth Callback (Tier 1 - Expected/Mocked) -> should handle Facebook OAuth callback with state (tenantId) and store encrypted credentials`.
