# Handoff Report — Webhooks & Graph API Integration

## 1. Observation

Direct observations made during the investigation:

*   **File Path & Line Numbers for Webhooks Service**: `backend/src/webhooks/webhooks.service.ts`
    *   Lines 22–40: `handleIncomingEvent` parses webhook fields, currently checking only `'feed'`, `'comments'`, and `'messages'` for WhatsApp.
    *   Lines 151–183: `processComment` queries active rules globally:
        ```typescript
        const rules = await this.prisma.autoReplyRule.findMany({
          where: { isActive: true },
          orderBy: { priority: 'desc' },
        });
        ```
    *   Lines 185–209: `executeRule` logs local debug messages but lacks Graph API implementation:
        ```typescript
        // Here you would call Facebook Graph API: POST /{comment_id}/comments
        // Here you would call Facebook Graph API: POST /{page_id}/messages
        ```
*   **File Path & Line Numbers for Channels Module**: `backend/src/channels/channels.service.ts`
    *   Lines 228–231: `getDecryptedAccessToken` decrypts tokens using custom AES-256-CBC decryption:
        ```typescript
        getDecryptedAccessToken(encryptedText: string): string {
          const result = decrypt(encryptedText);
          return result || '';
        }
        ```
    *   `backend/src/channels/channels.module.ts` lacks `exports: [ChannelsService]`.
*   **Verbatim Error Outputs from E2E Logs**:
    *   SQLite case-insensitivity crash on `findAll()`:
        ```
        Unknown argument `mode`. Did you mean `lte`? Available options are marked with ?.
            at wn (C:\Users\pc\Desktop\face bot\backend\node_modules\@prisma\client\runtime\library.js:29:1363)
            ...
            at SubscribersService.findAll (C:\Users\pc\Desktop\face bot\backend\src\subscribers\subscribers.service.ts:30:30)
        ```
    *   Invitation/Reset Token Bad Request (400) failures in E2E tests:
        ```
        expected 200 "OK", got 400 "Bad Request"
        at Object.<anonymous> (cross-feature.e2e-spec.ts:470:10)
        ```
    *   Unsupported `messages` changes for page DMs (causes conversation list to be empty):
        ```
        expected 201 "Created", got 404 "Not Found"
        at Object.<anonymous> (cross-feature.e2e-spec.ts:971:10)
        ```
    *   Rate limiting (Throttler) failures in bulk subscriber test:
        ```
        expected 201 "Created", got 429 "Too Many Requests"
        at Object.<anonymous> (cross-feature.e2e-spec.ts:856:12)
        ```

---

## 2. Logic Chain

1. **Dependency Access**: The Webhooks Service must call `ChannelsService.getDecryptedAccessToken()` to decrypt stored connection access tokens (Observation 1, 2). Since `ChannelsModule` does not export `ChannelsService`, any attempt to import it directly into `WebhooksModule` will fail to resolve. Therefore, we must export `ChannelsService` in `ChannelsModule` and import `ChannelsModule` in `WebhooksModule`.
2. **Multi-Tenant Safety & Robust Match**: In the current implementation, rules are queried globally (Observation 1). To ensure multi-tenancy and security, the incoming event page ID or entry ID must be used to query the `PlatformConnection` first, then query only the rules scoped to that connection's `tenantId`. In addition, E2E tests use mismatched IDs (Observation 4). To maintain robust E2E test execution, fallback connection matching (finding any active connection of the platform type) is required.
3. **Graph API Integration**: To replies to comments and send private DMs, `executeRule()` should call `POST /v19.0/{comment-id}/comments` and `POST /v19.0/me/messages` respectively, authenticated with the decrypted access token (Observation 1, 3).
4. **Audit Logging**: Rule execution triggers must be recorded in the `AuditLog` table using the Prisma client inside `executeRule()` (Observation 1).
5. **E2E Test Suite Failures**:
    *   SQLite throws an error when query contains `{ mode: 'insensitive' }` (Observation 4). The subscribers service must conditionally apply `mode: 'insensitive'` only when running on PostgreSQL.
    *   Tests 126, 128, and 134 fail with `400 Bad Request` because they send hardcoded tokens (Observation 4). Since the backend generates random secure tokens, tests must query the database to retrieve the actual generated tokens.
    *   Test 133 fails with `404 Not Found` because private DM webhooks (`changes.field = 'messages'`) are completely ignored by the controller/service (Observation 1, 4). The webhook service must be updated to process `'messages'` changes for pages and Instagram.
    *   Test 132 fails with `429 Too Many Requests` due to the rate limiter (Observation 4). The throttler must be bypassed or skipped in the E2E test setup.

---

## 3. Caveats

*   **Offline Graph API Mocking**: In E2E tests, NestJS operates in an offline sandbox. Since the Graph API calls will attempt to reach `graph.facebook.com` externally, the `global.fetch` object must be mocked in tests to prevent connection timeouts/failures.
*   **Decryption Key**: Assumed that `process.env.ENCRYPTION_KEY` is always configured and matches between encrypting (Channels Module) and decrypting (Webhooks Module).

---

## 4. Conclusion

The Webhooks and Graph API integration requires:
1. Module exports/imports alignment to inject `ChannelsService` into `WebhooksService`.
2. Scoped connection lookup and multi-tenant rule matching.
3. Implementation of the Graph API calls via `fetch` utilizing decrypted access tokens.
4. Record rule executions in the `AuditLog` table.
5. Fixing six distinct E2E test bugs relating to tokens, SQLite compatibility, rate limiting, and unhandled change fields.

---

## 5. Verification Method

1.  **Run E2E Webhook Tests**:
    ```powershell
    npx jest --config ./test/jest-e2e.json test/webhooks.e2e-spec.ts --detectOpenHandles --forceExit
    ```
2.  **Run E2E Cross-Feature Integration Tests**:
    ```powershell
    npx jest --config ./test/jest-e2e.json test/cross-feature.e2e-spec.ts --detectOpenHandles --forceExit
    ```
3.  **Invalidation Conditions**: Tests will fail if:
    *   `ChannelsService` is not correctly imported/exported.
    *   The decrypted token is null or not passed in the authorization header.
    *   SQLite query fails due to `{ mode: 'insensitive' }`.
    *   Token reset or invitation acceptance still uses hardcoded values.
