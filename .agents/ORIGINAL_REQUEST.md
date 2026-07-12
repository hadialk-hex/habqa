# Original User Request

## Initial Request — 2026-07-09T11:44:21Z

Transform **Hubqa (حبقة)**, an existing Arabic-language social media auto-reply platform (Next.js frontend + NestJS backend), from a basic MVP with mock4. Update plan and logs.

## Follow-up — 2026-07-11T09:01:33Z

CRITICAL DIRECTIVE: STOP all file operations on backend directory immediately. Do NOT run any npm commands, nest build, jest tests, or prisma commands on backend. Pause all work on backend files immediately and stop all terminal command execution. Await confirmation from main agent before resuming.ecurity vulnerabilities into a **production-grade, commercially competitive SaaS** that rivals ManyChat and Chatfuel, deployed via Docker on an Oracle ARM server with CasaOS.

Working directory: c:\Users\pc\Desktop\face bot
Integrity mode: development

## Context

### Existing Codebase
- **Frontend**: Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui + Framer Motion (8 pages, 4 custom components, 17 UI primitives)
- **Backend**: NestJS 11 + Prisma ORM + SQLite + JWT + Passport (7 modules, 15 API endpoints)
- **Language**: Arabic (RTL) — all UI text in Arabic, `lang="ar" dir="rtl"`
- **Font**: Tajawal (Google Fonts)

### Known Critical Issues (from full codebase audit)
1. **AuthGuard exists but is NEVER used** — all dashboard pages accessible without login
2. **All dashboard data is hardcoded mock** — KPI values, conversations, subscribers are JavaScript constants, not API calls
3. **Hardcoded JWT secret** in source code (`'super-secret-key-for-hubqa-change-in-production'`)
4. **Wide-open CORS** — `app.enableCors()` with no origin restriction
5. **SQLite database** — not suitable for production (no concurrent writes)
6. **`executeRule()` only logs** — does NOT actually call Facebook Graph API to send replies
7. **No webhook signature verification** — anyone can send fake webhook events
8. **Hardcoded user info** in sidebar ("محمد أحمد" regardless of logged-in user)
9. **No rate limiting, no structured logging, no Docker, no tests**
10. **No input validation DTOs** for channels/rules endpoints (body typed as `any`)
11. **`main.ts` overrides DATABASE_URL** with hardcoded SQLite path
12. **Platform access tokens stored in plaintext** — no encryption
13. **Inbox is read-only** — chat input exists but has no send functionality
14. **Settings page** — all save buttons are non-functional
15. **No mobile hamburger menu** on landing page
16. **No password reset flow**
17. **No WhatsApp webhook handling** despite being a featured platform

### Deployment Target
- Oracle Cloud ARM VM (4 cores, ~24GB RAM, ARM64/aarch64 architecture)
- CasaOS container management interface
- Docker Compose deployment
- **Important**: All Docker images must support `linux/arm64`

### Competitive Positioning
Must compete with ManyChat ($14-69/mo), Chatfuel ($39+/mo), Respond.io ($79+/mo). Key differentiator: Arabic-first, RTL-native, competitive pricing, all features included (no paid add-ons).

## Requirements

### R1. Security Hardening
The application must be hardened against common web vulnerabilities. All secrets must come from environment variables with no fallback defaults in source code. API endpoints must validate input data. Stored platform tokens must be encrypted. Webhook events must be cryptographically verified. The application must have rate limiting to prevent brute-force attacks. CORS must be restricted to configured origins. No security-sensitive data may be hardcoded in source code.

### R2. Production Database Migration
Migrate from SQLite to PostgreSQL. The database schema must include proper indexes on all frequently-queried columns, support for all features (audit logging, webhook deduplication, password reset tokens, API keys, broadcasts, flow automation), and use PostgreSQL-native features (real enums, JSON columns). All existing data models must be preserved and enhanced.

### R3. Complete & Functional API
Every frontend page must be backed by working API endpoints. The inbox must support sending messages (actually calling Facebook Graph API). Dashboard must show real data from the database. Settings must persist changes. Subscribers must be queryable. New modules needed: user profile management, subscriber/contact CRUD, enhanced analytics with date filtering, broadcast/campaign management, and a proper health check endpoint. All endpoints must use DTOs with validation.

### R4. Real Data Integration (No More Mock Data)
Every single piece of hardcoded/mock data in the frontend must be replaced with real API calls. The dashboard KPIs, inbox conversations, subscriber list, sidebar user info — everything must reflect actual database state. Loading states, error states, and empty states must be handled gracefully with user feedback in Arabic.

### R5. Competitive Feature Set
Implement features that make the platform commercially viable:
- **Comment-to-DM**: When user comments a keyword, auto-reply publicly + send private DM (the "killer feature" that drives ManyChat's adoption)
- **Broadcasting**: Send messages to subscriber segments with scheduling
- **Facebook OAuth flow**: One-click "Connect Facebook" button instead of manual Page ID entry
- **Working webhook processing**: Actually send replies via Graph API (not just log them)
- **WhatsApp webhook support**: Handle WhatsApp Cloud API events
- **Team management basics**: Invite members, assign roles
- **Enhanced analytics**: Charts with date range filtering
- **Password reset flow**: Email-based password recovery
- **Mobile responsive**: Hamburger menu on landing page, proper mobile inbox

### R6. Production Infrastructure
Create a complete Docker Compose setup that runs on ARM64 (Oracle Cloud ARM). Must include: PostgreSQL 17, Redis 7, NestJS backend, Next.js frontend. All services must have health checks. Include `.env.example` with all required variables documented. Include structured logging (not console.log). The setup must work with CasaOS container management. Include a `Makefile` or scripts for common operations (migrate, seed, logs, restart).

## Acceptance Criteria

### Security
- [ ] No hardcoded secrets anywhere in source code (grep for common patterns returns zero results)
- [ ] `npm audit` shows no high/critical vulnerabilities in both frontend and backend
- [ ] Rate limiting is active: hitting `/auth/login` 15 times in 10 seconds returns 429
- [ ] CORS rejects requests from unauthorized origins
- [ ] Webhook endpoint rejects requests without valid `X-Hub-Signature-256`
- [ ] All API endpoints that accept body data use validated DTOs (no `any` types)
- [ ] Stored `accessToken` values in database are not readable as plaintext

### Database
- [ ] `schema.prisma` uses `provider = "postgresql"`
- [ ] `npx prisma validate` passes with zero errors
- [ ] All models referenced in the Requirements exist in the schema
- [ ] Frequently-queried columns have `@@index` declarations

### API Completeness
- [ ] `backend/src` contains modules for: auth, channels, rules, inbox, webhooks, dashboard, users, subscribers, broadcasts, team
- [ ] `nest build` completes with zero TypeScript errors
- [ ] Health check endpoint at `GET /health` returns JSON with `status: 'ok'`

### Frontend Integration
- [ ] AuthGuard protects all `/dashboard/*` routes — unauthenticated access redirects to `/login`
- [ ] Dashboard page makes API calls (no hardcoded numbers in component source)
- [ ] Sidebar displays the authenticated user's actual name and email
- [ ] Inbox conversation list loads from API
- [ ] Settings save buttons trigger API calls with loading/success/error feedback
- [ ] Landing page has a working mobile hamburger menu
- [ ] `next build` completes with zero TypeScript errors

### Infrastructure
- [ ] `docker compose build` succeeds on the local machine
- [ ] `docker-compose.yml` defines services: postgres, redis, backend, frontend
- [ ] All Docker images specify `platform: linux/arm64` or use multi-arch images
- [ ] `.env.example` exists with all required environment variables documented
- [ ] Backend uses structured JSON logging (not console.log)

### Overall Quality
- [ ] Both `next build` (frontend) and `nest build` (backend) pass with zero errors
- [ ] The application starts and the landing page renders correctly at `http://localhost:3000`
- [ ] Registration → Login → Dashboard flow works end-to-end
- [ ] All Arabic text is properly displayed RTL
- [ ] No lorem ipsum, placeholder text, or English UI labels in user-facing pages

## Server Restart and Manual Completions — 2026-07-11T07:33:49Z

The server restarted and all tasks were stopped.

COMPLETED SO FAR:
- M1: Security Hardening (100%)
- M2: PostgreSQL Migration (100%)
- M6: Docker Infrastructure (100%)
- E2E Testing Track (100% - 135 tests)

USER MANUALLY COMPLETED (DO NOT OVERWRITE THESE FILES):
- frontend/src/app/dashboard/subscribers/page.tsx - Connected to real API
- frontend/src/app/dashboard/inbox/page.tsx - Full API integration with send messages
- frontend/src/app/dashboard/settings/page.tsx - Profile, password, company connected to API
- frontend/src/app/page.tsx - Mobile hamburger menu added

REMAINING WORK:
1. M3 (API Completeness) - Was at ~25%. Need to finish: users module, subscribers module, broadcasts module, team module, enhanced dashboard/analytics endpoints.
2. M4 (Frontend Integration) - Remaining: dashboard/page.tsx needs real API data (currently hardcoded KPIs), sidebar needs real user data.
3. M5 (Webhooks & Automation) - Comment-to-DM, Facebook OAuth, WhatsApp webhooks, actually calling Graph API.
4. M7 (Victory Verification) - Final audit.


## Follow-up — 2026-07-12T09:12:36Z

⚠️ تنبيه مهم — المتطلبات الجديدة هي الأولوية الآن!

المراحل القديمة (1-7) التي أنجزتموها ممتازة. لكن المستخدم طلب الآن تحديثات جديدة بالكامل وهي الأولوية القصوى:

### المتطلبات الجديدة (R1-R9) — الأولوية الآن:

**R1**: إصلاح كل Dropdowns/Select/Dialog overflow — z-index conflicts بين Select و Dialog
**R2**: إعادة تصميم كامل بـ Dark Neon — ألوان نيون تيل/سيان على خلفية سوداء، لا أي بنفسجي
**R3**: إصلاح 26+ زر ميت + استبدال كل alert()/confirm() بـ custom dialogs
**R4**: Rule Builder متقدم — تعديل قواعد + رسائل غنية (صور، كاروسيل، أزرار)
**R5**: صفحة Flow Builder جديدة — /dashboard/flows — سحب وإفلات بصري
**R6**: صفحة Broadcasting جديدة — /dashboard/broadcasts — إرسال جماعي + جدولة
**R7**: تحليلات متقدمة — رسوم بيانية حقيقية (recharts) + date range picker
**R8**: إدارة مشتركين متقدمة — tags + segments + pagination حقيقي + profile
**R9**: Inbox احترافي — رسائل غنية + conversation status + assign + canned responses

الرجاء التركيز على هذه المتطلبات التسع فوراً. التصميم أولاً (R1-R3) ثم الميزات (R4-R9).


## Follow-up — 2026-07-12T11:48:16Z

The server restarted. Resume parallel execution of Milestones 2, 3, and 4 (R4-R9). Note that the user has manually contributed to the subscribers/page.tsx to add server-side pagination, tag filtering, and inline tag addition. Verify the progress of the workers and continue the implementation until R1-R9 are fully complete.


## Follow-up — 2026-07-12T12:04:19Z

The user has manually implemented Milestone 4 Task 2 (Profile Drawer, CSV Export) in subscribers/page.tsx, as well as the Inbox features (Emojis, Attachments, Status toggles) in inbox/page.tsx. Inform the Milestone 4 sub-orchestrator to perform quick verification of these features and mark Milestone 4 as complete, focusing all remaining resources on finishing the Flow Builder (Tasks 4 and 5 in Milestone 2).




