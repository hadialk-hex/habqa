## 2026-07-09T12:49:46Z

You are the Worker subagent for Milestone 4 (M4_Frontend_Integration) of the Hubqa project.
Your working directory is `c:\Users\pc\Desktop\face bot\.agents\worker_m4\`.
Your mission is to write NestJS backend endpoints and Next.js frontend code to make the frontend integration fully functional, and pass the related E2E tests.

### MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Missing Backend Endpoints to Implement:
1. **Subscribers Module**:
   - Create a module/controller/service for `/subscribers`.
   - Update `backend/prisma/schema.prisma` to include a `Subscriber` model:
     ```prisma
     model Subscriber {
       id        String   @id @default(uuid())
       tenantId  String
       name      String
       phone     String?
       email     String?
       tags      String   @default("[]") // JSON string or comma-separated tags
       notes     String?
       createdAt DateTime @default(now())
       updatedAt DateTime @updatedAt
     }
     ```
     (or similar. Remember to validate email and phone format, deduplicate tags, and support search filter).
     Run Prisma commands to update the dev database (e.g. `npx prisma db push` or `npx prisma migrate dev`).
   - Implement `GET /subscribers` (accepts `search` query param), `POST /subscribers`, `GET /subscribers/:id`, `PATCH /subscribers/:id`, `DELETE /subscribers/:id`.
2. **Inbox Upgrades**:
   - In `InboxController`:
     - Implement `POST /inbox/conversations/:id/messages` (returns 400 if body is empty. If channel connection is invalid/revoked, mark `PlatformConnection` inactive and return 400/401/500).
     - Implement `PATCH /inbox/conversations/:id/read` (updates read status / resolution status).
     - Update `GET /inbox/conversations` to filter by `connectionId`, and support `page`/`limit` pagination.
     - Update `GET /inbox/conversations/:id/messages` to return `404` if the conversation doesn't exist.
3. **Auth Upgrades**:
   - In `AuthController`:
     - Implement `POST /auth/logout` (revokes current JWT token using an in-memory/set blacklist).
     - Implement `POST /auth/password-reset` and `POST /auth/password-reset/reset`.
     - Implement `PATCH /auth/profile` (updates logged-in user name).
4. **Rules & Connections Upgrades**:
   - In `RulesController` / `RulesService`:
     - Complete `GET /rules/:id/logs` to return logs or throw 404.
     - Validate channel connection activity status when triggering rules.
   - In `ChannelsController`:
     - Must restrict `DELETE /channels/:id` to `OWNER` role, else return `403 Forbidden`.

### Frontend Hookups (Replace mock data with real API calls):
1. **Dashboard Page (`src/app/dashboard/page.tsx`)**:
   - Fetch statistics from `/dashboard/stats` and map to KPI cards and platform stats bar.
   - Fetch recent chats and display them.
2. **App Sidebar (`src/components/app-sidebar.tsx`)**:
   - Fetch user details using `useAuth` user object and display user name, email, and initials in the footer.
   - Make the footer profile block open a dropdown menu with a Logout option (triggers `logout` from `useAuth` and redirects to `/login`).
3. **Settings Page (`src/app/dashboard/settings/page.tsx`)**:
   - Load user's profile info (name, email) from API or auth context.
   - Hook up save button in Profile tab to update details (`PATCH /auth/profile`).
   - Hook up save button in Company tab to update workspace name (`PUT /tenants/:id` or similar endpoint).
   - Hook up update password button in Security tab to save new password via password reset/profile update.
4. **Subscribers Page (`src/app/dashboard/subscribers/page.tsx`)**:
   - Fetch subscribers list from `/subscribers` API, support search input, pagination controls, and display real statistics counts.
5. **Inbox Page (`src/app/dashboard/inbox/page.tsx`)**:
   - Fetch conversations list, fetch messages thread for the active conversation, mark as read on select, and enable message sending via POST input.
   - Handle API loading, error, and empty states gracefully in Arabic.
   - Implement mobile responsiveness (toggle conversation list vs chat thread view, add mobile back button).
6. **Landing Page (`src/app/page.tsx`)**:
   - Implement a mobile responsive hamburger menu/drawer using shadcn Sheet component.
7. **AuthGuard route protection**:
   - Confirm route protection is functional (non-authenticated users accessing `/dashboard/*` redirect to `/login`).

### Verification Command to Run:
Ensure you run all compilation checks (`npm run build` in both backend and frontend), linting, and verify that E2E tests run successfully (e.g. `npx jest --config ./test/jest-e2e.json test/inbox.e2e-spec.ts --runInBand`). Document the commands run and results in your handoff report.
Write your progress in `.agents/worker_m4/progress.md`.

## 2026-07-09T13:24:19Z
Parent message: Focus on writing the frontend integrations immediately and update your progress log.
Dashboard, Settings, Subscribers, Inbox, Sidebar, and Landing page hamburger menu.

