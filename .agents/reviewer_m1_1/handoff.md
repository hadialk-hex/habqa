# Handoff Report — Milestone 1 Security Hardening Review

## 1. Observation

### Backend Compilation Failures
During `npm run build` in `backend/`, the TypeScript compiler failed with 2 errors:
```
src/subscribers/subscribers.service.ts:32:9 - error TS2322: Type 'string' is not assignable to type 'string[] | SubscriberCreatetagsInput | undefined'.

32         tags: JSON.stringify(uniqueTags),
           ~~~~

  node_modules/.prisma/client/index.d.ts:30073:5
    30073     tags?: SubscriberCreatetagsInput | string[]
              ~~~~
src/subscribers/subscribers.service.ts:70:11 - error TS2322: Type 'string' is not assignable to type 'string[] | SubscriberCreatetagsInput | undefined'.

70           tags: JSON.stringify(['promo']),
             ~~~~
```
*(Also, `update` method in `subscribers.service.ts:91` performs `updateData.tags = JSON.stringify(...)` which bypasses compile-time checks via `any` but will fail at database runtime since the database field is mapped to a string array).*

### Frontend Compilation Failures
During `npx next build` in `frontend/`, the TypeScript compiler failed with 1 error:
```
./src/components/app-sidebar.tsx:101:32
Type error: Type '{ children: Element; asChild: true; }' is not assignable to type 'IntrinsicAttributes & Props<unknown>'.
  Property 'asChild' does not exist on type 'IntrinsicAttributes & Props<unknown>'.

   99 |       <SidebarFooter className="border-t border-sidebar-border p-3">
  100 |         <DropdownMenu>
> 101 |           <DropdownMenuTrigger asChild>
      |                                ^
```

### Backend E2E Test Failures (Docker Dependency)
Running `npm run test:e2e` in `backend/` failed during global setup because Docker is not running or available on the host system:
```
[E2E Global Setup] Detected Prisma provider: postgresql
Syncing schema to E2E test database: postgresql://postgres:password@localhost:5433/hubqa_test?schema=public
Programmatically ensuring PostgreSQL container is started...
unable to get image 'postgres:17-alpine': failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
...
Error: P1001: Can't reach database server at `localhost:5433`
```

### Access Token Exposure in REST API
In `backend/src/channels/channels.service.ts`, the `getConnections` and `getConnection` methods return the decrypted Facebook Page Access Token to the client-side:
```typescript
  async getConnections(tenantId: string) {
    const connections = await this.prisma.platformConnection.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return connections.map((conn) => ({
      ...conn,
      accessToken: conn.accessToken
        ? decrypt(conn.accessToken)
        : conn.accessToken,
    }));
  }
```
In `backend/src/channels/channels.controller.ts`, the `getChannels` endpoint is accessible by any logged-in user:
```typescript
  @UseGuards(JwtAuthGuard)
  @Get()
  async getChannels(@Request() req: any) {
    return this.channelsService.getConnections(req.user.tenantId);
  }
```

### Test-Specific Code Leaks in Production Services
We observed several test-specific hardcoded logic blocks inside backend services:
- `backend/src/auth/auth.service.ts`: `if (!user && email === 'test@example.com')` and `(dto.token === 'valid_reset_token' || dto.token === 'expired_reset_token')`
- `backend/src/team/team.service.ts`: `if (dto.token === 'valid_invitation_token_123')`
- `backend/src/subscribers/subscribers.service.ts`: `if (!subscriber && id === 'subscriber-id-123')`

### Dummy/Facade Implementations
- `backend/src/rules/rules.service.ts`: `getLogs` is a stub returning `[]`.
- `backend/src/channels/channels.controller.ts`: `getChannelDetails` is a stub returning `{ id, details: 'mocked' }`.

---

## 2. Logic Chain

1. **Backend Build Failure**: The compiler error in `subscribers.service.ts` shows that `tags` (defined as `String[]` in `schema.prisma`) is being populated with a stringified JSON array (`JSON.stringify(uniqueTags)`). Because Prisma client expects a JavaScript array of strings (`string[]`) for `String[]` database fields, the compile fails. This represents a build regression.
2. **Frontend Build Failure**: The compiler error in `app-sidebar.tsx` shows that `DropdownMenuTrigger` uses `asChild`. Since the dropdown menu component wraps Base UI (`@base-ui/react/menu`), which does not support the `asChild` property, the TypeScript compilation fails. This is a build regression.
3. **Security Infiltration via Token Exposure**: Decrypting the database credentials/access tokens and returning them in the response of `GET /channels` means any team member role (e.g. `AGENT` or `VIEWER`) can access `/channels` and retrieve the raw Page Access Token. This compromises token confidentiality.
4. **Test Code Leak**: Production services contain specific conditional branches targeting test-specific emails and tokens. These bypass standard authentication/registration/database checks, which is a code quality concern.

---

## 3. Caveats

- We assumed that the local development environment does not have a running Docker Engine, which explains why the E2E tests cannot spin up the PostgreSQL container.
- We did not evaluate the frontend UI visually since the build failed and we are operating in a review-only subagent role.

---

## 4. Conclusion

The verdict is **REQUEST_CHANGES**.
The implementation contains compile-time regressions that prevent both backend and frontend applications from building, exposing Page Access Tokens to all authenticated workspace roles, and mixing test mocks in production files.

---

## 5. Verification Method

To verify the findings:
1. Run backend compilation:
   ```powershell
   cd backend
   npm run build
   ```
2. Run frontend compilation:
   ```powershell
   cd frontend
   npm run build
   ```
3. Inspect `backend/src/channels/channels.service.ts` to confirm access token decryption is returned on `getConnections`.

---

# Quality Review Report

## Review Summary

**Verdict**: REQUEST_CHANGES

## Findings

### Critical Finding 1: Backend Type Compile Error
- **What**: Compilation failure due to incorrect mapping of `tags` string array.
- **Where**: `backend/src/subscribers/subscribers.service.ts:32` and `backend/src/subscribers/subscribers.service.ts:70`.
- **Why**: TypeScript compiler prevents building because it expects `string[]` for database column tags, but code passes `JSON.stringify(array)`.
- **Suggestion**: Change `tags: JSON.stringify(uniqueTags)` to `tags: uniqueTags` and `tags: JSON.stringify(['promo'])` to `tags: ['promo']`. Update `update` method accordingly to avoid runtime errors.

### Critical Finding 2: Frontend Type Compile Error
- **What**: Compilation failure due to using Radix UI `asChild` prop on a Base UI component.
- **Where**: `frontend/src/components/app-sidebar.tsx:101`.
- **Why**: `<DropdownMenuTrigger>` is mapped to Base UI trigger component which does not accept `asChild` prop, causing Next.js compilation to fail.
- **Suggestion**: Remove `asChild` from `<DropdownMenuTrigger>` and structure the trigger element correctly without trying to forward Radix ref options, or wrap it in a custom button/div according to Base UI documentation.

### Critical Finding 3: Security Infiltration via Page Access Token Leakage
- **What**: Decrypted `accessToken` returned to clients on Channels endpoints.
- **Where**: `backend/src/channels/channels.service.ts` in `getConnections` and `getConnection`.
- **Why**: Exposing raw page access tokens to the frontend or any user authenticated with a JWT token (e.g. `AGENT` or `VIEWER` roles) allows credentials leakage.
- **Suggestion**: Return a masked value (e.g., `*` characters or a boolean flag like `hasAccessToken: true`) instead of the decrypted token in the API response.

### Major Finding 4: Production Service Test Logic Leaks
- **What**: Specific conditions handling mock values for E2E tests are present in production services.
- **Where**: `backend/src/auth/auth.service.ts`, `backend/src/team/team.service.ts`, and `backend/src/subscribers/subscribers.service.ts`.
- **Why**: Pollution of production code paths with test fixtures bypasses database checks.
- **Suggestion**: Move mock database seeding and token initialization to test setup files (`setup.ts` or E2E specification files) rather than service implementation.

---

# Adversarial Review Report

## Challenge Summary

**Overall risk assessment**: HIGH

## Challenges

### Critical Challenge 1: Page Access Token Leakage
- **Assumption challenged**: That only authorized Page owners will see the decrypted accessToken.
- **Attack scenario**: A malicious team member with `VIEWER` or `AGENT` role calls `GET /channels` endpoint. The controller does not restrict channel reading based on roles (only channel deletion is restricted to `OWNER`). The attacker recovers the Page Access Token and uses it to hijack the Facebook Page.
- **Blast radius**: Full compromise of the connected Facebook and WhatsApp platform accounts.
- **Mitigation**: Filter out `accessToken` from the API response or restrict channel queries to owners, and only retrieve tokens internally when making platform calls.

### High Challenge 2: Timing Attacks on Webhook Signatures
- **Assumption challenged**: That webhook signature validation is completely timing-safe.
- **Attack scenario**: Attackers target the webhook handler. Although `crypto.timingSafeEqual` is used, the controller extracts the signature hash directly using `signature.slice(7)`. If the signature doesn't start with `sha256=` or is very short, it could cause early exits before timingSafeEqual, or crash.
- **Blast radius**: Although the catch block handles signature length differences safely, timing differences in parsing headers could still be abused if the signature format check exits early.
- **Mitigation**: Ensure all signature comparisons use a standard length hashing comparison or check size match in a timing-neutral way.

---

## Verified Claims

- JWT secret fetched from ConfigService → verified via `auth.module.ts` and `jwt.strategy.ts` → PASS
- Webhook signature verification uses X-Hub-Signature-256 and `crypto.timingSafeEqual` → verified via `webhooks.controller.ts` → PASS
- CORS restrictions configurable via env allowed origins → verified via `main.ts` → PASS
- Throttler rate limiting applied globally → verified via `app.module.ts` → PASS

---

## Unverified Items

- Webhook handling flow and automation execution → not verified due to Docker database daemon being unavailable to spin up the PostgreSQL schema for tests.
