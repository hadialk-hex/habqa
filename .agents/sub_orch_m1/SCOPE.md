# Scope: Milestone 1 Security Hardening

## Architecture
The application consists of:
- **Backend (NestJS)**: Standard Modular NestJS with Prisma ORM. Port 3001.
- **Frontend (Next.js)**: App Router with React, Tailwind CSS 4, shadcn/ui. Port 3000.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1.1 | Environment & Secrets Migration | Move JWT secret and app secrets to environment variables via NestJS `ConfigService`. Remove hardcoded secrets. | None | IN_PROGRESS (Conv: ac3a6c0c-21c5-4784-93af-e7f894fbf26c) |
| 1.2 | AuthGuard & Route Security | Implement/enforce `JwtAuthGuard` on all dashboard backend endpoints and secure Next.js frontend `/dashboard` routes using the existing `AuthGuard` component. | 1.1 | IN_PROGRESS (Conv: ac3a6c0c-21c5-4784-93af-e7f894fbf26c) |
| 1.3 | Login Rate Limiting | Enforce ThrottlerModule rate limiting (15 attempts per 10 seconds) on the login endpoint. | None | IN_PROGRESS (Conv: ac3a6c0c-21c5-4784-93af-e7f894fbf26c) |
| 1.4 | Webhook Signature Verification | Validate incoming Meta webhooks using `X-Hub-Signature-256` header and `rawBody` payload cryptographic hash checking. | None | IN_PROGRESS (Conv: ac3a6c0c-21c5-4784-93af-e7f894fbf26c) |
| 1.5 | CORS Origin Controls | Restrict API CORS origins to configured values from environmental variables in `main.ts`. | None | IN_PROGRESS (Conv: ac3a6c0c-21c5-4784-93af-e7f894fbf26c) |
| 1.6 | DTO Input Validation | Enforce ValidationPipe and DTO class-validator validation on all API endpoints. | None | IN_PROGRESS (Conv: ac3a6c0c-21c5-4784-93af-e7f894fbf26c) |
| 1.7 | Database Token Encryption | Encrypt platform access tokens in the SQLite database (`PlatformConnection` model) using cryptographic AES-256 encryption. | None | IN_PROGRESS (Conv: ac3a6c0c-21c5-4784-93af-e7f894fbf26c) |

## Interface Contracts
- JWT secrets read from `process.env.JWT_SECRET` via `ConfigService`.
- Webhook validation uses `process.env.APP_SECRET` for HMAC-SHA256 matching.
- CORS reads origins from `process.env.ALLOWED_ORIGINS` (comma-separated list).
- Encryption key reads from `process.env.ENCRYPTION_KEY` (32 bytes hex).
