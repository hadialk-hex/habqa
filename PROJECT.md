# Project: Hubqa RTL Dark Neon SaaS Overhaul (R1-R9)

## Architecture
- **Frontend**: Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui + Framer Motion (RTL Arabic Tajawal font)
- **Backend**: NestJS 11 + Prisma ORM + PostgreSQL 17 + Redis 7 + JWT/Passport
- **Infrastructure**: Docker Compose (linux/arm64 multi-arch targets)

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1_Design_Overhaul | Design Overhaul (R1-R3): Neon Teal/Cyan theme, zero purple (hex/tailwind), z-index dropdown fixes, custom confirmation dialogs, custom toast notifications, layout animations. | None | PLANNED |
| 2 | M2_Rules_Flows | Advanced Rule Builder (R4) & Flow Builder (R5): Rule editing, rich reply formats, drag-to-reorder sequences, live previews, SVG/ReactFlow Flow Builder at `/dashboard/flows`. | M1_Design_Overhaul | PLANNED |
| 3 | M3_Broadcasts_Analytics | Broadcasting (R6) & Analytics (R7): Campaigns page with list/details, targeting filters, simulated delivery charts, and upgraded dashboard with interactive Recharts charts and date range picker. | M1_Design_Overhaul | PLANNED |
| 4 | M4_Subscribers_Inbox | Subscriber Profiles (R8) & Professional Inbox (R9): Real server-side pagination, tag/segment manager, subscriber drawer, CSV export. Inbox with rich messaging, status controls, team assignment, and canned replies. | M1_Design_Overhaul | PLANNED |

## Interface Contracts
### Visual Theme Requirements
- Primary Dark Backgrounds: `#0a0a0f` or `#0d1117`
- Neon Accents: Neon Teal `#0ff5d4` / Cyan `#00e5ff`
- Absolutely zero purple color codes, styles, or tailwind classes (e.g. `bg-purple-600`, `text-violet-500`, `#8b5cf6`).

### Native Window Methods Replacements
- Replace `window.alert()` with a custom Toast / Notification component.
- Replace `window.confirm()` with a custom Confirmation Dialog modal.
- Replace `window.location.reload()` with state revalidation, router refreshes, or React context updates.

## Code Layout
- `backend/` -> NestJS Backend application
- `frontend/` -> Next.js Frontend application
- `docker-compose.yml` -> Production docker-compose configuration
