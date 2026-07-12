## 2026-07-09T13:33:53Z
You are the Worker for Milestone 1: Security Hardening (Fixes).
Your working directory is: `c:\Users\pc\Desktop\face bot\.agents\worker_fix\`.
Your parent conversation ID is: `727af49b-126d-4770-b3c6-36112bf2cf02`.
Your mission is to resolve the compile-time and security issues identified during the review phase.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please execute the following fixes in the codebase:

1. **Fix backend compilation errors in subscribers.service.ts**:
   - Open `backend/src/subscribers/subscribers.service.ts`.
   - In `mapSubscriber(sub: any)`, replace `tags: sub.tags ? JSON.parse(sub.tags) : []` with `tags: sub.tags || []`.
   - In `create`, change `tags: JSON.stringify(uniqueTags)` to `tags: uniqueTags`.
   - In `findOne`, change `tags: JSON.stringify(['promo'])` to `tags: ['promo']`.
   - In `update`, change `updateData.tags = JSON.stringify(Array.from(new Set(dto.tags)));` to `updateData.tags = Array.from(new Set(dto.tags));`.

2. **Fix backend compilation error in auth.controller.ts**:
   - Open `backend/src/auth/auth.controller.ts`.
   - In `updateProfile` endpoint (line 76), change `this.authService.updateProfile(req.user.id, dto.name)` to `this.authService.updateProfile(req.user.id, dto.name || undefined)`.

3. **Fix frontend compilation error in app-sidebar.tsx**:
   - Open `frontend/src/components/app-sidebar.tsx`.
   - Locate `<DropdownMenuTrigger asChild>` (line 101).
   - Remove `asChild` prop.
   - Pass className and custom styling to `DropdownMenuTrigger` directly: `<DropdownMenuTrigger className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent transition-colors cursor-pointer group w-full text-right border-none bg-transparent outline-none">`.

4. **Address Page Access Token REST exposure (Security)**:
   - In `backend/src/channels/channels.service.ts`, modify `getConnections(tenantId)` (lines 59-64), `getConnection(tenantId, id)` (lines 75-79), and `addConnection(tenantId, data)` (lines 117-122) to return a masked value `accessToken: conn.accessToken ? '***' : null` instead of decrypting the access token to the API response.
   - Decryption function `decrypt` should only be used internally when backend needs to use the token to call Facebook APIs (which is done in automated flows / webhooks in later milestones). Do not return decrypted tokens to the REST clients.

5. **Update E2E test assertions**:
   - In `backend/test/challenger.e2e-spec.ts`, locate lines 283, 304, and 314 where `res.body.accessToken` is asserted.
   - Update assertions to expect `'***'` instead of `rawToken` (since the REST API now returns the masked token).
   - Ensure the test still validates that the token is encrypted in the database (which it does at lines 290-296).

6. **Webhook Rate Limiting Bypass (Robustness)**:
   - In `backend/src/webhooks/webhooks.controller.ts`, import `SkipThrottle` from `@nestjs/throttler`.
   - Decorate the `WebhooksController` class with `@SkipThrottle()` to exempt webhooks from the global rate limiting guard, preventing Meta webhook blocking under high comment volume.

Once these changes are made:
- Run `npm run build` in both `backend/` and `frontend/` to confirm that all TypeScript compilation issues are fully resolved.
- Write your completion report to `c:\Users\pc\Desktop\face bot\.agents\worker_fix\handoff.md`.
- When done, report back to your parent conversation.
