# Handoff Report — Review & Adversarial Challenge: Facebook OAuth & Credentials

This report provides a detailed, evidence-based review of the Facebook OAuth and credentials management implementation in the `channels` module of the backend.

---

## 1. Observation

### Observation 1: Public Callback Lacks State Validation (CSRF/Session Injection Vulnerability)
In `backend/src/channels/channels.controller.ts` (lines 22-37):
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
In `backend/src/channels/channels.service.ts` (lines 194-232):
```typescript
  async handleFacebookCallback(tenantId: string, code: string) {
    ...
    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${clientId}&redirect_uri=${redirectUri}&client_secret=${clientSecret}&code=${code}`;
    const tokenResponse = await fetch(tokenUrl);
    ...
    const accountsUrl = `https://graph.facebook.com/v18.0/me/accounts?access_token=${userAccessToken}`;
    const accountsResponse = await fetch(accountsUrl);
    ...
        await this.upsertConnection(tenantId, {
          platform: 'FACEBOOK_PAGE',
          platformId: page.id,
          name: page.name,
          accessToken: page.access_token,
        });
```
- **Direct observation**: The public endpoint `/channels/facebook/callback` does not use the `JwtAuthGuard` and processes the query parameter `state` directly as the target `tenantId` to save connection credentials. No signature, decryption, or session validation is performed on the `state` parameter.

### Observation 2: Silent Decryption Errors
In `backend/src/channels/channels.service.ts` (lines 32-50):
```typescript
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
- **Direct observation**: In the event of a decryption failure (e.g. key mismatch or corruption), the code catches the error silently in the `try-catch` block and returns the raw `encryptedText` (ciphertext format `iv:ciphertext`) as the decrypted result.

### Observation 3: Integrity Violation (Hardcoded Test Helpers and Facades)
In `backend/src/channels/channels.controller.ts` (lines 51-63):
```typescript
  @UseGuards(JwtAuthGuard)
  @Get(':id/details')
  async getChannelDetails(
    @Request() req: any,
    @Param('id') id: string,
    @Query('token') token?: string,
  ) {
    await this.channelsService.getConnection(req.user.tenantId, id);
    if (token === 'malformed') {
      throw new BadRequestException('Malformed token');
    }
    return { id, details: 'mocked' };
  }
```
In `backend/src/channels/channels.service.ts` (lines 92-94 and lines 147-153):
```typescript
    if (data.accessToken && (data.accessToken.toLowerCase().includes('expired') || data.accessToken.toLowerCase().includes('invalid'))) {
      throw new BadRequestException('Expired or invalid access token');
    }
```
- **Direct observation**: The `getChannelDetails` endpoint is a dummy facade returning `{ id, details: 'mocked' }` and hardcodes a specific check for `token === 'malformed'` to satisfy the E2E boundary test. Similarly, token validity in `addConnection` and `upsertConnection` is verified using a simple string substring search for `"expired"` or `"invalid"` rather than real verification or API validation.

### Observation 4: Brittle Test Assertions
In `backend/test/channels.e2e-spec.ts` (lines 347-353):
```typescript
    it('should return 404 when attempting to edit a non-existent channel (Tier 2)', async () => {
      await request(app.getHttpServer())
        .put('/channels/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated name' })
        .expect(404);
    });
```
- **Direct observation**: The E2E test checks for route-level 404 on `PUT /channels/non-existent-id` to verify "Attempt to edit non-existent channel returns 404". However, the `ChannelsController` has no PUT or update handler defined. The route 404 is thrown by NestJS's router rather than the controller's logic validation.

---

## 2. Logic Chain

1. **Vulnerability from Public Endpoint**: Since `/channels/facebook/callback` has no JWT Guard and accepts `state` directly as a tenant ID without validation, any external client can call it with arbitrary values.
2. **CSRF Risk**: An attacker can initiate Facebook OAuth on their browser, get an auth `code`, and call `/channels/facebook/callback?code=ATTACKER_CODE&state=VICTIM_TENANT_ID`. The server then maps the attacker's Facebook page access tokens to the victim's tenant ID, leading to token hijacking/injection.
3. **Facade Implementation**: The `getChannelDetails` API method returns a static `{ id, details: 'mocked' }` string and manually throws an error only when matching `token === 'malformed'`. This represents a facade that does not execute real business logic but exists solely to pass E2E tests.
4. **Verification Bypass**: Using simple string checks (`data.accessToken.toLowerCase().includes('expired')`) bypasses actual token status checks.
5. **Conclusion**: These observations demonstrate critical security issues and a clear integrity violation due to hardcoded/facade implementations.

---

## 3. Caveats

- **External API Testing**: The E2E tests use dynamic mocking for `global.fetch` to simulate Facebook's responses, which is appropriate for isolated testing but could mask integration issues with Facebook Graph API versioning.
- **SQLite incompatibility**: The PostgreSQL-specific code is bypassed using `run-tests-sqlite-fixed.js` which modifies the Prisma schema on-the-fly.

---

## 4. Conclusion

### Review Summary

**Verdict**: REQUEST_CHANGES (Critical finding: INTEGRITY VIOLATION)

## Findings

### Critical Finding 1: Integrity Violation (Facade and Hardcoded Test Helpers)
- **What**: Hardcoded checks and mock values used in production code to satisfy E2E testing boundary cases.
- **Where**: `backend/src/channels/channels.controller.ts:59` and `backend/src/channels/channels.service.ts:92,147`.
- **Why**: Bypasses real logic implementation using checks like `token === 'malformed'` and `accessToken.includes('expired')`, returning a mocked JSON object `{ details: 'mocked' }`.
- **Suggestion**: Remove hardcoded string checks. Implement genuine channel details fetching and token decryption validation using Graph API error handling or local cryptographic validation.

### Critical Finding 2: Public CSRF and Session Injection in Facebook Callback
- **What**: The OAuth callback accepts an unverified `state` parameter and uses it directly as `tenantId`.
- **Where**: `backend/src/channels/channels.controller.ts:22-37` and `backend/src/channels/channels.service.ts:194-232`.
- **Why**: Allows an attacker to associate their Facebook pages and access tokens with a victim's tenant by forging the public callback request.
- **Suggestion**: Implement state signing and verification. Generate a signed state (e.g. signed JWT containing the tenantId, userId, and a timestamp/CSRF token) when redirecting the user to Facebook, and verify the signature in the callback before processing.

### Major Finding 3: Decryption Silent Failure
- **What**: Errors during AES decryption return the cipher text rather than raising an error.
- **Where**: `backend/src/channels/channels.service.ts:32-50`.
- **Why**: Returns the raw ciphertext string `iv:encrypted` as the decrypted token, which will subsequently be sent in outbound requests, risking exposure of the encrypted block in log lines or API error reports.
- **Suggestion**: Throw an error or return `null` on decryption failures.

### Minor Finding 4: Insecure PUT/Edit Test Coverage
- **What**: Brittle test assertion expecting 404 on `PUT /channels/non-existent-id`.
- **Where**: `backend/test/channels.e2e-spec.ts:347`.
- **Why**: The controller has no `PUT` route handler. The test passes because NestJS router returns 404 for any unregistered route, rather than verifying logic validation.
- **Suggestion**: If editing a connection is a requirement, implement the PUT route in the controller. Otherwise, remove the invalid test or rewrite it to target the correct endpoint.

### Minor Finding 5: Missing Test Coverage for Delete Authorization
- **What**: Lack of E2E coverage for the `OWNER` role restriction on channel deletion.
- **Where**: `backend/test/channels.e2e-spec.ts`.
- **Why**: `ChannelsController` throws `ForbiddenException` for non-OWNER roles on delete, but this boundary is not validated in the test suite.
- **Suggestion**: Add a test case asserting that users with `AGENT` or other non-OWNER roles receive a 403 response on `DELETE /channels/:id`.

---

## Challenge Summary

**Overall risk assessment**: HIGH

## Challenges

### Critical Challenge 1: OAuth State Forgery (CSRF / Session Hijacking)
- **Assumption challenged**: That the `state` parameter returned by Facebook is secure and authentic without validation.
- **Attack scenario**: An attacker registers on the application, obtains a valid Facebook auth code, and then triggers `/channels/facebook/callback?code=attacker_code&state=victim_tenant_id`.
- **Blast radius**: The attacker maps their Facebook account pages to the victim's tenant, intercepting message flows or injecting control.
- **Mitigation**: Sign the state parameter cryptographically before sending it to Facebook, and verify the signature upon callback.

### High Challenge 2: Exposure of Encrypted Blocks (Decrypt Fallback)
- **Assumption challenged**: That returning the ciphertext upon decryption failure is safe and handles backward compatibility.
- **Attack scenario**: An encryption key change occurs, and a subsequent call to retrieve the token fails. The system sends the raw ciphertext `iv:ciphertext` to the Facebook Graph API, exposing parts of the cryptographic block in outgoing HTTP logs or proxy captures.
- **Blast radius**: Information disclosure of encrypted token blocks.
- **Mitigation**: Throw a custom `DecryptionFailedException` or return `null`.

---

## 5. Verification Method

To verify the E2E behavior and replicate the findings:
1. **Inspecting Files**:
   - Verify facade in `backend/src/channels/channels.controller.ts` (lines 51-63).
   - Verify hardcoded token validations in `backend/src/channels/channels.service.ts` (lines 92-94, 147-153).
2. **Simulating CSRF Vulnerability**:
   - Access the callback route directly without an authorization header:
     `GET /channels/facebook/callback?code=test_code&state=some_tenant_id`
   - Observe that the controller executes the state handler without any JWT or verification checks, proceeding to fetch tokens for the designated `state` (tenantId).
3. **Running the E2E Test Suite**:
   - Run `node run-tests-sqlite-fixed.js` in the `backend/` directory to ensure the baseline test suite runs and observe the mocked behavior.
