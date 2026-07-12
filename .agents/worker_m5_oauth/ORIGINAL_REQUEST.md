## 2026-07-11T07:46:44Z
You are teamwork_preview_worker. Your working directory is c:\Users\pc\Desktop\face bot\.agents\worker_m5_oauth\.
Mission: Implement Facebook OAuth callback flow and credentials encryption/decryption as per Milestone 5.1.
Tasks:
1. Run `npm install` inside the `backend` folder to resolve Jest and dependencies.
2. In `backend/src/channels/channels.service.ts`:
   - Inject `ConfigService` (from `@nestjs/config`).
   - Implement `upsertConnection(tenantId: string, data: { platform: any; platformId: string; name: string; accessToken: string; })` which encrypts `accessToken` and saves or updates the connection.
   - Implement `handleFacebookCallback(tenantId: string, code: string)` which uses global `fetch` to exchange the auth code for a User Access Token, then queries `/me/accounts` to retrieve page list, and then upserts each page connection using `upsertConnection`.
   - Expose a public method `getDecryptedAccessToken(encryptedText: string): string` which uses the existing `decrypt` function.
3. In `backend/src/channels/channels.controller.ts`:
   - Modify the `facebookCallback` endpoint to receive `code` and optional `state` query parameters.
   - If `state` is present, call `channelsService.handleFacebookCallback(state, code)`. If `state` is not present, log a warning and return `{ success: true, message: 'OAuth callback verified (dry run)' }` to preserve compatibility with existing E2E tests.
4. In `backend/test/channels.e2e-spec.ts`:
   - Add a test that verifies the full callback behavior (with `state` and `code` parameters) by mocking the global `fetch` API, checking that the platform connection is created in the database, and verifying that the stored access token is encrypted.
5. Verify your changes by running the test suite: `node run-tests-sqlite.js` or `npm run test` inside the `backend` folder. Make sure the channels E2E tests pass.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT
hardcode test results, create dummy/facade implementations, or
circumvent the intended task. A Forensic Auditor will independently
verify your work. Integrity violations WILL be detected and your
work WILL be rejected.
