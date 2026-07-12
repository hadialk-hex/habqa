# Handoff Report: Milestone 5.1 (OAuth and Credentials) Investigation

## 1. Observation

During the read-only investigation, the following files and configurations were examined:
1. **`backend/src/channels/channels.controller.ts`**:
   - `GET /channels/facebook/callback` is defined as (lines 22-28):
     ```typescript
     @Get('facebook/callback')
     async facebookCallback(@Query('code') code: string) {
       if (!code) {
         throw new BadRequestException('Code is required');
       }
       return { success: true };
     }
     ```
   - It only checks for the presence of `code` and returns `{ success: true }`, with no authentication guards or tenant association logic.
   - Other endpoints (`GET /channels`, `GET /channels/:id`, `POST /channels`, `DELETE /channels/:id`) use `@UseGuards(JwtAuthGuard)` to secure requests using the tenant's JWT.

2. **`backend/src/channels/channels.service.ts`**:
   - Helper functions `encrypt` and `decrypt` implement symmetric key encryption (lines 10-48):
     - Cipher algorithm: `aes-256-cbc`
     - Key derivation: SHA-256 hash of `process.env.ENCRYPTION_KEY`
     - IV generation: Random 16 bytes (`crypto.randomBytes(16)`)
     - Database format: `iv_hex:ciphertext_hex`
     - Decryption: Split by `:` and decrypt using IV. If parsing fails, it falls back to the original string.
   - `addConnection` method (lines 78-117) encrypts the `accessToken` and inserts a new connection. If a connection with the same `platform` and `platformId` already exists, it throws a `ConflictException` (lines 91-99):
     ```typescript
     const existing = await this.prisma.platformConnection.findFirst({
       where: {
         platform: data.platform,
         platformId: data.platformId,
       },
     });
     if (existing) {
       throw new ConflictException('Channel is already connected');
     }
     ```
   - Connection queries (`getConnections` and `getConnection`) sanitize the return payloads by replacing `accessToken` with `'***'` or `null` (lines 59-62, 72-75).

3. **`backend/prisma/schema.prisma`**:
   - The `PlatformConnection` model has a unique constraint on platform and platform ID (lines 183-187):
     ```prisma
     @@unique([platform, platformId])
     @@index([tenantId])
     @@index([platformId])
     @@index([isActive])
     ```
   - This constraint ensures that a specific social media channel (e.g., Facebook Page ID) can only be linked once across the system.

4. **`backend/.env`**:
   - Contains `APP_SECRET="facebook-app-secret-key"` and `ENCRYPTION_KEY="super-secret-encryption-key-32ch-long-here"` (lines 4-5).

5. **`backend/test/channels.e2e-spec.ts`**:
   - Contains a test for the mock callback behavior (lines 218-225):
     ```typescript
     describe('Facebook OAuth Callback (Tier 1 - Expected/Mocked)', () => {
       it('should handle Facebook OAuth callback successfully (Tier 1)', async () => {
         await request(app.getHttpServer())
           .get('/channels/facebook/callback')
           .query({ code: 'valid_facebook_auth_code' })
           .expect(200);
       });
     });
     ```

6. **Test Execution Command (`npm run test:e2e`)**:
   - Executing `npm run test:e2e` inside `backend/` resulted in the following dependency error:
     ```
     Error: Cannot find module 'C:\Users\pc\Desktop\face bot\backend\node_modules\@jest\core\build\index.js'
     ```
     This suggests the local node environment's dependencies are incomplete/damaged.

---

## 2. Logic Chain

From the observations above, we can deduce the behavior of the system and reconstruct how the complete flow should look:
1. **OAuth Callback Request is Public**: Unlike most resource endpoints in `channels.controller.ts`, `GET /channels/facebook/callback` cannot be protected by the standard `JwtAuthGuard` since the redirect originates directly from the user's browser hitting the endpoint via Facebook's redirect.
2. **State Verification is Required**: Because the callback is public, the only secure way to link the callback request to the correct tenant (and prevent CSRF attacks) is by verifying a cryptographically signed/encrypted `state` parameter generated during the login initiation. This state must carry the `tenantId` (e.g., in a signed JWT state).
3. **Facebook OAuth Exchange Sequence**:
   - The auth flow yields a temporary `code`.
   - The backend must exchange this `code` for a User Access Token.
   - The User Access Token is short-lived. To get durable page tokens, the backend must exchange the short-lived user token for a **Long-Lived User Access Token** (valid for ~60 days).
   - Using this long-lived user token, the backend queries the user's accounts (`GET /me/accounts`). This API call returns a list of Facebook Pages managed by the user, including long-lived, non-expiring **Page Access Tokens**.
4. **Token Encryption**:
   - The page access tokens must be encrypted using `aes-256-cbc` via the existing `encrypt()` function in `channels.service.ts` prior to saving in the database to prevent database-compromise leaks.
5. **Database Constraint & Upsert Behavior**:
   - Since `platform` and `platformId` have a unique constraint, trying to reconnect a previously connected channel using `addConnection` will throw a `ConflictException`.
   - The actual implementation must handle re-connection (upserting) by checking if the existing channel belongs to the same tenant. If it does, it should update the name, reset `isActive` to `true`, and encrypt/update the `accessToken`. If it belongs to a different tenant, it should reject or transfer the connection based on business rules.

---

## 3. Caveats

1. **Jest Dependency Issue**: The local testing environment returned a missing `@jest/core` dependency error. Since this is a read-only investigation, the codebase and packages were not modified.
2. **Third-Party API Mocking**: The real integration relies on Facebook's Graph API, which cannot be invoked without internet access and active client credentials (due to the `CODE_ONLY` network constraint). Thus, any actual implementation must mock the Graph API responses in testing environments.

---

## 4. Conclusion

To complete Milestone 5.1, the mock implementation of the Facebook callback must be replaced with a robust OAuth exchange flow that:
- Receives both `code` and `state`.
- Verifies the `state` JWT/payload to obtain the `tenantId`.
- Interacts with the Facebook Graph API to exchange the code for user tokens and eventually extract long-lived Page Access Tokens.
- Encrypts these tokens using the existing `ChannelsService` encryption helpers.
- Performs an upsert operation in the database to avoid unique constraint violations when pages are reconnected.
- Redirects the user's browser back to the frontend dashboard with a status query parameter.

---

## 5. Verification Method

Once implemented, the changes should be verified as follows:
1. **Fix Dependencies**: Run `npm install` inside the `backend/` directory to resolve the `@jest/core` module error.
2. **E2E Test Execution**: Run `npm run test:e2e` to verify that existing connection tests pass.
3. **Write Callback Integration Tests**:
   - Mock `fetch` or the Facebook Graph API request to return mock page tokens and user accounts.
   - Verify that the callback endpoint returns a `302 Redirect` to the frontend.
   - Verify that the page access token is encrypted in the database but returned sanitized (`'***'`) from endpoints.
   - Verify that invalid/missing `state` or `code` parameters correctly trigger `400` or redirect to the frontend with an error code.

---

## Recommended Implementation Strategy

### Step 1: Secure State Parameter Generation & Verification
Define a helper service (e.g., using `@nestjs/jwt` which is already in dependencies) to sign and verify the `state` parameter:
```typescript
// During OAuth initiation redirect generation:
const state = this.jwtService.sign({ tenantId }, { secret: process.env.JWT_SECRET, expiresIn: '15m' });
```

### Step 2: Update the Callback Endpoint in `channels.controller.ts`
Implement standard OAuth callback logic, utilizing native `fetch`:
```typescript
import { Res, Query } from '@nestjs/common';
import { Response } from 'express';

@Get('facebook/callback')
async facebookCallback(
  @Query('code') code: string,
  @Query('state') state: string,
  @Res() res: Response,
) {
  const frontendUrl = process.env.ALLOWED_ORIGINS?.split(',')[0] || 'http://localhost:3000';
  
  if (!code || !state) {
    return res.redirect(`${frontendUrl}/dashboard/channels?status=error&message=Missing+parameters`);
  }

  try {
    // 1. Verify State & Extract tenantId
    const decoded = this.jwtService.verify(state, { secret: process.env.JWT_SECRET });
    const tenantId = decoded.tenantId;

    // 2. Exchange authorization code for short-lived User Access Token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.APP_SECRET}&redirect_uri=${process.env.BACKEND_CALLBACK_URL}&code=${code}`
    );
    const tokenData = await tokenResponse.json() as any;
    if (tokenData.error) throw new Error(tokenData.error.message);

    const userAccessToken = tokenData.access_token;

    // 3. Exchange for long-lived User Access Token
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.APP_SECRET}&fb_exchange_token=${userAccessToken}`
    );
    const longLivedData = await longLivedResponse.json() as any;
    if (longLivedData.error) throw new Error(longLivedData.error.message);

    const longLivedUserToken = longLivedData.access_token;

    // 4. Retrieve page listings and long-lived page tokens
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${longLivedUserToken}`
    );
    const pagesData = await pagesResponse.json() as any;
    if (pagesData.error) throw new Error(pagesData.error.message);

    // 5. Encrypt tokens and save pages
    for (const page of pagesData.data) {
      await this.channelsService.upsertConnection(tenantId, {
        platform: 'FACEBOOK_PAGE',
        platformId: page.id,
        name: page.name,
        accessToken: page.access_token,
      });
    }

    return res.redirect(`${frontendUrl}/dashboard/channels?status=success`);
  } catch (error: any) {
    return res.redirect(`${frontendUrl}/dashboard/channels?status=error&message=${encodeURIComponent(error.message)}`);
  }
}
```

### Step 3: Implement `upsertConnection` in `channels.service.ts`
Implement a secure upsert method that updates credentials for existing platform connections:
```typescript
async upsertConnection(
  tenantId: string,
  data: {
    platform: 'FACEBOOK_PAGE' | 'INSTAGRAM' | 'WHATSAPP';
    platformId: string;
    name: string;
    accessToken: string;
  },
) {
  const encryptedToken = encrypt(data.accessToken);

  const existing = await this.prisma.platformConnection.findUnique({
    where: {
      platform_platformId: {
        platform: data.platform,
        platformId: data.platformId,
      },
    },
  });

  if (existing) {
    if (existing.tenantId !== tenantId) {
      throw new ConflictException('Channel is already connected to another tenant');
    }
    // Update existing connection
    return this.prisma.platformConnection.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        accessToken: encryptedToken,
        isActive: true,
      },
    });
  }

  // Create new connection
  return this.prisma.platformConnection.create({
    data: {
      tenantId,
      platform: data.platform,
      platformId: data.platformId,
      name: data.name,
      accessToken: encryptedToken,
      isActive: true,
    },
  });
}
```
