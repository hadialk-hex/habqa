# Scope: M4_Frontend_Integration

## Architecture
- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + shadcn/ui.
- **Backend**: NestJS 11 + Prisma ORM (SQLite for dev, Postgres prepared).

## Milestones and Sub-tasks
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Backend API Support | Implement missing endpoints: Subscribers CRUD, Profile update (`/auth/profile`), Inbox send/read message, Reset password endpoints. | None | PLANNED |
| 2 | Dashboard Integration | Fetch KPI stats and platform stats from `/dashboard/stats`. Fetch recent chats. Display real values. | M1 | PLANNED |
| 3 | Profile & Settings | Fetch logged-in user in Sidebar. Implement Settings forms (profile, company, password change) saving to the backend API. | M1 | PLANNED |
| 4 | Subscribers Page | Fetch real subscribers list with search and pagination from `/subscribers`. | M1 | PLANNED |
| 5 | Inbox Page | Fetch conversations list, fetch messages, and hook up send message input to POST API. Add mobile view toggle (chat vs list). | M1 | PLANNED |
| 6 | Landing Hamburger | Add mobile-responsive hamburger menu to `src/app/page.tsx` header. | None | PLANNED |
| 7 | Graceful States (AR) | Handle loading/error/empty states in Arabic on Dashboard, Settings, Subscribers, and Inbox. | M2, M3, M4, M5 | PLANNED |

## Interface Contracts

### 1. Subscribers API
- `GET /subscribers` -> Query params: `search` (optional). Returns `Subscriber[]`
- `POST /subscribers` -> Body: `{ name, phone, email, tags: string[] }`. Returns `Subscriber`
- `GET /subscribers/:id` -> Returns `Subscriber`
- `PATCH /subscribers/:id` -> Body: `{ name?, phone?, email?, tags?, notes? }`. Returns `Subscriber`
- `DELETE /subscribers/:id` -> Returns `{ success: true }`

### 2. Inbox API
- `POST /inbox/conversations/:id/messages` -> Body: `{ content }`. Returns `Message`
- `PATCH /inbox/conversations/:id/read` -> Body: `{ read: boolean }`. Returns updated conversation

### 3. Profile & Password Reset API
- `PATCH /auth/profile` -> Body: `{ name? }`. Returns updated user (matches test expected profile endpoint)
- `POST /auth/password-reset` -> Body: `{ email }`. Sends reset token (mocked)
- `POST /auth/password-reset/reset` -> Body: `{ token, password }`. Resets password (mocked)

### 4. Tenant Update API
- `PUT /tenants/:id` or custom route to update tenant name (used on company settings tab).
