## 2026-07-09T11:51:05Z
You are the Worker for Milestone 1: Security Hardening.
Your working directory is: `c:\Users\pc\Desktop\face bot\.agents\worker_m1_1\`.
Your parent conversation ID is: `727af49b-126d-4770-b3c6-36112bf2cf02`.
Your mission is to implement security hardening in both NestJS backend and Next.js frontend codebases.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please execute the following 7 tasks:

1. **Move JWT Secret to Environment Variables & remove hardcoded secrets**:
   - Install `@nestjs/config` in the backend (`npm install @nestjs/config` in `backend/`).
   - Import `ConfigModule` in `backend/src/app.module.ts`.
   - Update `backend/src/auth/auth.module.ts` to register `JwtModule` asynchronously using `ConfigService` to read `JWT_SECRET`. Ensure there is NO hardcoded secret fallback.
   - Update `backend/src/auth/strategies/jwt.strategy.ts` to inject `ConfigService` and construct passport options using `ConfigService.get('JWT_SECRET')`. Ensure there is NO hardcoded secret fallback.

2. **AuthGuard & Frontend Dashboard Route Security**:
   - Enforce `JwtAuthGuard` on dashboard backend endpoints (verify `backend/src/dashboard/dashboard.controller.ts` is guarded, which it is).
   - In Next.js frontend, wrap dashboard routes in the existing client-side `AuthGuard`. Edit `frontend/src/app/dashboard/layout.tsx` to import `AuthGuard` from `@/components/auth-guard` and wrap the layout children (or main view layout) inside `<AuthGuard>...</AuthGuard>`.

3. **Login Rate Limiting (15 login attempts in 10 seconds returns 429)**:
   - Install `@nestjs/throttler` in the backend (`npm install @nestjs/throttler` in `backend/`).
   - Register `ThrottlerModule` in `backend/src/app.module.ts` using `ThrottlerModule.forRoot([{ ttl: 10000, limit: 15 }])`.
   - Apply `ThrottlerGuard` globally by defining `{ provide: APP_GUARD, useClass: ThrottlerGuard }` in `AppModule` providers, or apply it to the login/register endpoints on `AuthController` via `@UseGuards(ThrottlerGuard)`. Applying it on the auth controller or globally is acceptable; choose the cleanest approach.

4. **Validate Webhook Signature using X-Hub-Signature-256**:
   - In `backend/src/main.ts`, enable raw body parsing by passing `{ rawBody: true }` option to `NestFactory.create(AppModule, { rawBody: true })`.
   - In `backend/src/webhooks/webhooks.controller.ts`, intercept the `x-hub-signature-256` header on `POST` requests.
   - Using Node's cryptographic hash functions (`crypto`), verify that the signature in the header matches the HMAC-SHA256 hash of the `req.rawBody` buffer computed using `process.env.APP_SECRET` as the key.
   - If signature is missing or does not match, throw an `UnauthorizedException` or return a `401 Unauthorized` response.

5. **Limit CORS to Configured Origins**:
   - In `backend/src/main.ts`, update `app.enableCors(...)`. Read the allowed origins from environment variable `ALLOWED_ORIGINS` (which can be a comma-separated list of origins, e.g. `http://localhost:3000`). If `ALLOWED_ORIGINS` is configured, restrict CORS to only those origins. If not configured, fall back to a default like `http://localhost:3000`.

6. **Enforce DTO Validation on all Backend API Endpoints**:
   - `ValidationPipe` is already applied globally in `main.ts`.
   - You need to add proper DTO request body validation for endpoints in `RulesController` (`backend/src/rules/rules.controller.ts`) and `ChannelsController` (`backend/src/channels/channels.controller.ts`).
   - Define `CreateRuleDto` and `UpdateRuleDto` in `backend/src/rules/dto/rules.dto.ts` with appropriate `class-validator` decorators (e.g., `@IsString()`, `@IsNotEmpty()`, `@IsOptional()`, `@IsBoolean()`, `@IsInt()`). Use these DTOs instead of `body: any` in `RulesController`.
   - Define `AddConnectionDto` in `backend/src/channels/dto/channels.dto.ts` with appropriate validation decorators. Use it instead of `body: any` in `ChannelsController`.

7. **Encrypt Platform Access Tokens in the Database**:
   - Implement encryption/decryption functions using Node's `crypto` module (e.g., AES-256-CBC with an IV, using `crypto.createCipheriv` and `crypto.createDecipheriv`).
   - Load the encryption key from `process.env.ENCRYPTION_KEY` (ensure it handles keys of appropriate length).
   - In `backend/src/channels/channels.service.ts`, encrypt `accessToken` in the `addConnection` method before storing it in the database.
   - Decrypt `accessToken` when retrieving connections in `getConnections` or other fetch queries.

Verify your work:
- Run `npm run build` in both `backend/` and `frontend/` to ensure typescript compilation passes.
- Run `npm run test` and `npm run test:e2e` in `backend/` to verify tests pass.
- Write your completion report/handoff to `c:\Users\pc\Desktop\face bot\.agents\worker_m1_1\handoff.md`.

Do not edit files outside the project scope. When completed, send a message to your parent conversation.
