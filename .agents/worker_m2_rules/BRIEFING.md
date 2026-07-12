# BRIEFING — 2026-07-12T12:02:00Z

## Mission
Implement backend database schema, NestJS APIs, and Next.js frontend components for Rules CRUD, Rich Messages, and Rules Analytics.

## 🔒 My Identity
- Archetype: implementer, qa, specialist
- Roles: implementer, qa, specialist
- Working directory: c:\Users\pc\Desktop\face bot\.agents\worker_m2_rules\
- Original parent: fbde584b-5190-4361-b9f4-22926f0aa15f
- Milestone: M2_Rules_Flows

## 🔒 Key Constraints
- CODE_ONLY network mode. No external HTTP requests.
- No hardcoded test results, expected outputs, or verification strings in source code.
- No dummy/facade implementations.
- Arabic Tajawal font RTL layout.
- Visual Theme: Neon Teal/Cyan, absolutely zero purple.
- Custom Confirmation Dialog & Toast instead of native window alert/confirm.

## Current Parent
- Conversation ID: fbde584b-5190-4361-b9f4-22926f0aa15f
- Updated: 2026-07-12T12:02:00Z

## Task Summary
- **What to build**: Update Prisma schema with triggerCount, lastTriggeredAt, replyMessages. Migrate. Update backend Rules API (Create, Update, trigger, webhook auto-reply executor with sequential delay/timing and fallback). Upgrade Frontend Rules Page with rules editing, Rich Message Sequence Builder (2 to 5 messages, drag-and-drop/index reordering, message types: TEXT, IMAGE, CAROUSEL, QUICK_REPLIES), Mobile Phone Preview (platform toggle for Messenger / WhatsApp, real-time rendering in Tailwind), Rules Analytics display in cards, and Predefined Templates Library.
- **Success criteria**: Rules CRUD is fully functional (creation & editing), supports rich sequence messages, has live mobile preview, displays analytics, and has templates library. SQLite test script runs successfully and all tests pass. TypeScript compilation passes on frontend & backend.
- **Interface contracts**: c:\Users\pc\Desktop\face bot\PROJECT.md
- **Code layout**: NestJS at backend/, Next.js at frontend/

## Key Decisions Made
- Use Prisma `db push` to bypass non-interactive mode limitation for dev.
- Implement Facebook Messenger-compatible structures for TEXT, IMAGE, CAROUSEL, and QUICK_REPLIES in sequential sending.
- Implement EPERM lock bypass for Windows Prisma client generation using a rename trick.
- Adapt `cleanDatabase` function to be resilient to missing/mocked transaction client functions under SQLite.

## Artifact Index
- `backend/prisma/schema.prisma` - DB Schema
- `backend/src/rules/dto/rules.dto.ts` - DTO definitions
- `backend/src/rules/rules.service.ts` - CRUD business logic
- `backend/src/webhooks/webhooks.service.ts` - Webhook rules matching and sequence execution
- `frontend/src/app/dashboard/rules/page.tsx` - Main Rules CRUD & Rich Sequence Message Builder Frontend Page
- `backend/run-tests-sqlite-fixed.js` - SQLite test runner with EPERM lock bypass
- `backend/test/db-cleanup.ts` - Robust database cleanup script

## Change Tracker
- **Files modified**:
  - `backend/prisma/schema.prisma` - Added fields and CampaignStatus update.
  - `backend/src/rules/dto/rules.dto.ts` - Added fields to DTOs.
  - `backend/src/rules/rules.service.ts` - Support saving replyMessages and trigger increments.
  - `backend/src/webhooks/webhooks.service.ts` - Sequential delay rules execution.
  - `frontend/src/app/dashboard/rules/page.tsx` - Rules frontend upgrade.
  - `backend/run-tests-sqlite-fixed.js` - Added Prisma generation rename bypass.
  - `backend/test/db-cleanup.ts` - Safe `deleteMany` check.
- **Build status**: Both NestJS backend and Next.js frontend compile cleanly without any TypeScript errors.
- **Pending issues**: None.

## Quality Status
- **Build/test result**: Frontend and backend compile successfully.
- **Lint status**: 0 outstanding violations.
- **Tests added/modified**: E2E channel tests cleanup robustified.
