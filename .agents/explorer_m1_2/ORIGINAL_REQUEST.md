## 2026-07-09T11:48:52Z
You are Explorer 2 for Milestone 1: Security Hardening.
Your working directory is: `c:\Users\pc\Desktop\face bot\.agents\explorer_m1_2\`.
Your mission is to perform a read-only investigation of the codebase to design a concrete strategy for:
1. Move JWT secret to environment variables (`ConfigService`) and remove hardcoded secrets in `backend/src/auth/auth.module.ts` and `backend/src/auth/strategies/jwt.strategy.ts`. Recommend if we should install `@nestjs/config` and how to use it.
2. Verify where `JwtAuthGuard` is used in backend controllers and check how to secure the frontend React/Next.js dashboard routes (e.g. wrapping in `AuthGuard` in `frontend/src/app/dashboard/layout.tsx`).
3. Detail how to implement rate limiting (15 login attempts in 10 seconds returns 429) via `ThrottlerModule` in NestJS backend (e.g., configuring `ThrottlerModule` in `AppModule` and applying `ThrottlerGuard` globally or on `AuthController`).
4. Detail how to validate incoming Facebook/WhatsApp webhook signatures using `X-Hub-Signature-256` and cryptographic hash check. Explain how to configure `rawBody: true` in NestJS `main.ts` and read `req.rawBody` buffer in `WebhooksController` or `WebhooksService` to compute HMAC-SHA256 signature and match it.
5. Limit CORS in `backend/src/main.ts` to configured origins read from environment variables.
6. Enforce DTO validation on all backend API endpoints. Check if there are any endpoints/controllers missing validation decorators or validation pipes, and check how they are currently validated.
7. Encrypt platform access tokens in the SQLite database (`PlatformConnection` model in Prisma). Detail how to implement transparent encryption/decryption (e.g., using `crypto` module in `ChannelsService` or in a database layer/Prisma middleware, using an encryption key from environment variables).

Analyze existing code, verify imports, and write your recommendations to `c:\Users\pc\Desktop\face bot\.agents\explorer_m1_2\handoff.md`.
Do NOT write or edit any source files. Do NOT run build/test commands.
When done, send a message to your parent conversation (ID: 727af49b-126d-4770-b3c6-36112bf2cf02).
