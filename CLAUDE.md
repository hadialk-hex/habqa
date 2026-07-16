# Hubqa (حبقة)

Arabic-first RTL SaaS for social-media auto-replies. Next.js 16 frontend
(`frontend/`, port 3000/1998-prod) + NestJS 11 backend (`backend/`, port
3001/1999-prod) + Prisma/PostgreSQL. Production: hubqa.hex-tic.xyz — CasaOS
auto-pulls `main`, so **every push to main deploys**.

## Meta / Graph API — read the reference first

`docs/meta-api/` is the project's authoritative Meta reference (Graph API
v25.0, Messenger, Instagram, WhatsApp Cloud, webhooks, permissions, rate
limits, error codes, App Review). **Before changing any Meta integration,
consult the relevant file there** — payload shapes and endpoints in it were
verified against live behavior:

- Messenger/IG DMs arrive in `entry[].messaging[]`; comments in
  `entry[].changes[]` (feed/comments). Both must stay handled.
- All outbound Graph calls go through `backend/src/common/graph-api-client.ts`
  (retry, rate-limit headers, error classification via `graph-api-errors.ts`).
  Never call `fetch` on graph.facebook.com directly.
- The version constant lives ONLY in `backend/src/common/graph-api.ts`.
- Facebook comment replies: `POST /{comment-id}/comments`; Instagram:
  `POST /{ig-comment-id}/replies`.
- Messenger sends past the 24h window need `messaging_type: MESSAGE_TAG` +
  `tag: HUMAN_AGENT` (7-day limit, needs Meta approval).

## Conventions

- Prisma schema changes: `npx prisma db push` (NO migrations folder;
  docker-entrypoint uses db push).
- Access tokens are AES-encrypted at rest — decrypt via
  `ChannelsService.getDecryptedAccessToken`.
- Verify before pushing: backend `npx eslint . && npx tsc --noEmit && npm run
  build`; frontend `npx tsc --noEmit && npx eslint src`.
- i18n: every user-facing string needs keys in BOTH
  `frontend/src/lib/i18n/dictionaries/ar.ts` and `en.ts`.
