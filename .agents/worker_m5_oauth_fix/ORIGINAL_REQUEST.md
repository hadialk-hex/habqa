## 2026-07-11T09:21:54Z

You are teamwork_preview_worker. Your working directory is c:\Users\pc\Desktop\face bot\.agents\worker_m5_oauth_fix\.
Mission: Resolve critical security vulnerabilities, remove facade/hardcoded test helpers, fix E2E mock crashes, and complete Milestone 5.1 (OAuth & Credentials) implementation.

Tasks:
1. In `backend/src/channels/channels.controller.ts`:
   - Implement state signing and verification. Generate signed state (HMAC of tenantId using process.env.APP_SECRET) to prevent OAuth CSRF/Session Hijacking.
   - Verify the state signature in `facebookCallback`. If signature fails, check if state matches a UUID or "demo-tenant-id" (fallback for tests) to remain compatible, otherwise throw BadRequestException.
   - Update `getChannelDetails` (endpoint `/channels/:id/details`): remove the hardcoded check for `token === 'malformed'` and the mock return value. Instead, call `channelsService.getChannelDetails(tenantId, id, token)`.
   - Add a PUT handler `@Put(':id')` to update page connection name:
     `async updateConnection(@Request() req: any, @Param('id') id: string, @Body() dto: { name: string })`
2. In `backend/src/channels/channels.service.ts`:
   - Implement `getChannelDetails(tenantId: string, id: string, customToken?: string)`: fetch connection, decrypt token, make a fetch request to Facebook Graph API (`https://graph.facebook.com/v19.0/{platformId}?fields=name,about,picture,fan_count&access_token={token}`). If the fetch fails, parse the error and throw BadRequestException.
   - Update `upsertConnection` and `addConnection`: If a connection with the same `platform` and `platformId` already exists, check if its `tenantId` is different from the current `tenantId`. If they mismatch, throw a `ConflictException` ('Channel is already connected to another tenant') to prevent cross-tenant hijacking.
   - Update the `decrypt` helper: throw a BadRequestException / InternalServerErrorException if decryption fails (e.g. wrong key, missing key, padding issues) instead of silently returning the ciphertext.
   - Add the PUT service method `updateConnection(tenantId: string, id: string, data: { name: string })` that throws NotFoundException if the connection is not found.
   - Remove any production hardcoded checks for "expired" or "invalid" substrings.
3. In `backend/test/channels.e2e-spec.ts`:
   - Fix the `mockPrismaService` to correctly handle memberships and nested tenant relationships during `user.create` and `user.findUnique`. Ensure the registered user returns a memberships array containing a tenant reference to prevent `AuthService` registration crashing with a TypeError.
   - Add E2E tests for the PUT endpoint, and mock the global `fetch` API for `getChannelDetails` to verify 400 is returned when the token is 'malformed'.
4. Verify your changes by running the tests: `node node_modules/jest/bin/jest.js --config ./test/jest-e2e.json test/channels.e2e-spec.ts` inside the `backend` folder. Ensure all tests pass.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT
hardcode test results, create dummy/facade implementations, or
circumvent the intended task. A Forensic Auditor will independently
verify your work. Integrity violations WILL be detected and your
work WILL be rejected.
