## 2026-07-12T10:05:00Z

You are the Worker subagent for Milestone 3 (Broadcasting & Analytics) in the Hubqa RTL Dark Neon SaaS Overhaul.
Your working directory is `c:\Users\pc\Desktop\face bot\.agents\worker_m3_broadcasts_analytics_1\`.
Your archetype is `teamwork_preview_worker`.

Please carry out the following task instructions to implement tasks 1-6:

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Design Constraints
- Accent colors must strictly utilize Dark Neon Teal (#0ff5d4 / var(--primary)) and Dark Neon Cyan (#00e5ff / var(--secondary)). Absolutely NO purple/violet colors/styles anywhere.
- Replace all alert(), confirm(), and window.location.reload() calls with custom Toast or Dialog hooks (useConfirm and useToast from the project's frontend UI library).

## Tasks to Implement:
1. **Broadcasts backend endpoint & schema**:
   - Add a `findAll` method in `backend/src/broadcasts/broadcasts.service.ts` that retrieves all broadcasts for a tenant ordered by `createdAt` desc.
   - Route `GET /broadcasts` in `backend/src/broadcasts/broadcasts.controller.ts` to `findAll`.
   - Update `backend/test/broadcasts.e2e-spec.ts` to add a test verifying the new list endpoint.

2. **Analytics stats endpoint enhancement**:
   - Create `GetStatsDto` in `backend/src/dashboard/dto/dashboard.dto.ts` with `range?: 'today' | '7days' | '30days' | 'custom'`, `startDate?: string`, `endDate?: string`.
   - Update `backend/src/dashboard/dashboard.controller.ts` to accept the query parameter.
   - Update `backend/src/dashboard/dashboard.service.ts`'s `getStats` method to filter statistics and calculate trends (percentage changes) between the selected period (Current Period) and the preceding period of equal length (Previous Period).
     - Calculate percentages: `((current - previous) / previous) * 100` (or `0` if both are 0, or `100` if previous is 0 and current > 0).
     - Return trends: `subscribersTrend`, `autoRepliesTrend`, `conversationsTrend`, and `rulesTrend` along with the totals.
   - Update `backend/test/dashboard.e2e-spec.ts` to verify date filtering and trend calculations.

3. **Background scheduler/cron setup**:
   - Install `@nestjs/schedule` in `backend/package.json`.
   - Import and register `ScheduleModule.forRoot()` in `backend/src/app.module.ts`.
   - Add `@Cron(CronExpression.EVERY_MINUTE)` task in `backend/src/broadcasts/broadcasts.service.ts` to find all campaigns with status `SCHEDULED` whose `scheduledAt <= new Date()` and automatically call the existing `execute` method for them.

4. **Navigation Sidebar link**:
   - Add a menu link for Campaigns in `frontend/src/components/app-sidebar.tsx` with title "الحملات الإعلانية", url "/dashboard/broadcasts", and icon `Megaphone` (imported from `lucide-react`).

5. **Recharts Integration & Dashboard page**:
   - Install `recharts` and `@types/recharts` (devDependency) in `frontend/package.json` (use `--legacy-peer-deps` since React 19 is used).
   - Update `frontend/src/app/dashboard/page.tsx`:
     - Add a date range selector at the top.
     - Fetch backend `/dashboard/stats` endpoint with selected query parameters on filter change.
     - Parse and display trend percentages inside the KPI cards using Teal/Cyan neon styling for positive trends and red/destructive styling for negative trends.
     - Replace the custom HTML-based timeline bar chart with a beautiful Recharts AreaChart or BarChart using a Teal/Cyan neon gradient.
     - Remove the duplicate "Quick Stats" section at the bottom of the platform stats card (duplicates KPI cards).

6. **Broadcast Campaign UI (`/dashboard/broadcasts/page.tsx`)**:
   - Create a fully styled RTL Campaigns page in Next.js.
   - Include:
     - Paginated and filterable campaign lists (Draft, Scheduled, Sending, Completed) showing campaign name, target tags, platform, status, date, and metrics.
     - Campaign creation form/wizard (name, rich content, target tags, platform, scheduling date/time or send now).
     - Delivery stats panel/drawer (sent, delivered, read, clicked counts).
     - Use custom toasts (`useToast`) and confirmations (`useConfirm`) instead of window alerts.

## Verification
- Run `npm run build` in both `backend` and `frontend` directories to make sure there are no TypeScript compilation errors.
- Run `npm run test` and `npm run test:e2e` in `backend` to verify tests pass successfully.

Write a progress report to `progress.md` and handoff report to `handoff.md` in your working directory when completed. Send me a message when done.
