# Exploration & Recommendation Report: Milestone 3 (Broadcasting & Analytics)

This report details the findings and recommendation strategy for Milestone 3 (Broadcasting & Analytics) of the Hubqa RTL Dark Neon SaaS Overhaul.

---

## 1. Backend Broadcasts Endpoints & Database Schema
- **Location**: `backend/src/broadcasts/`
- **Existing Endpoints**:
  - `POST /broadcasts` — Creates a broadcast (draft or scheduled).
  - `POST /broadcasts/:id/schedule` — Schedules a draft broadcast to a future date.
  - `POST /broadcasts/:id/execute` — Immediately executes the broadcast to a target segment.
  - `GET /broadcasts/:id/metrics` — Fetches the metrics (`sentCount`, `deliveredCount`) for a broadcast.
  - `POST /broadcasts/:id/cancel` — Cancels a scheduled broadcast.
  - `GET /broadcasts/:id` — Fetches details for a single broadcast.
- **Analysis**:
  - Currently, there is **no endpoint to retrieve all broadcasts** (`findAll`) for a tenant. We must add `GET /broadcasts` in `BroadcastsController` and link it to a service method `findAll(tenantId)` that queries the database.
- **Database Schema Confirmation**:
  - In `backend/prisma/schema.prisma`, the `Broadcast` model is declared as follows:
    ```prisma
    model Broadcast {
      id             String    @id @default(uuid())
      tenantId       String
      name           String
      content        String
      segmentTarget  String?
      status         CampaignStatus @default(DRAFT) // DRAFT, SCHEDULED, SENT, CANCELLED
      scheduledAt    DateTime?
      sentCount      Int       @default(0)
      deliveredCount Int       @default(0)
      createdAt      DateTime  @default(now())
      updatedAt      DateTime  @updatedAt
      tenant         Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
      @@index([tenantId])
    }
    ```
    This schema is fully complete and correct; no changes to the Prisma schema are needed.

---

## 2. Dashboard Analytics & Statistics Enhancement
- **Location**: `backend/src/dashboard/`
- **Current Behavior**:
  - `GET /dashboard/stats` is a static endpoint with no query filters. It queries total unique customers across conversations (`totalSubscribers`), total outbound messages (`totalAutoReplies`), count of open conversations (`activeConversations`), count of active auto-reply rules (`totalRules`), recent 5 conversations, connection distribution, and message activity for the last 14 days.
  - `GET /dashboard/analytics` accepts `startDate` and `endDate` query parameters to return daily message volumes (sent vs. received) grouped by date.
- **Recommended Enhancements**:
  - Enhance `GET /dashboard/stats` to accept query parameters: `range` (`today`, `7days`, `30days`, `custom`), `startDate`, and `endDate`.
  - Calculate date ranges for both the **Current Period** and the **Previous Period** of equal length.
  - Query each KPI metric for the current period and previous period, then calculate the percentage trend:
    $$\text{trendPercentage} = \frac{\text{Current} - \text{Previous}}{\text{Previous}} \times 100$$
  - Return the computed trend percentages for:
    - **New/Active Subscribers** (based on `Subscriber` creation date or conversation customer count).
    - **Auto Replies** (outbound messages).
    - **Active Conversations** (conversations created/active).
    - **Active Rules** (active auto-reply rules).

---

## 3. Frontend Dashboard Page & Recharts Dependency
- **Location**: `frontend/src/app/dashboard/page.tsx`
- **Current Behavior**:
  - The page displays four KPI cards with hardcoded `trend: "neutral"` and `trend: "up"` labels.
  - The 14-day activity timeline is rendered using a custom-made bar graph (nested HTML divs with percentage heights).
- **Dependency Analysis**:
  - Inspecting `frontend/package.json` reveals that **`recharts` is not installed** in the frontend dependencies.
- **Recommendation**:
  - Install `recharts` and `@types/recharts` in the frontend.
  - Replace the custom HTML bar graph with a proper Recharts `AreaChart` or `BarChart` designed with a Dark Neon glow matching the project's CSS variables.
  - Incorporate the trend percentages returned by the enhanced backend stats endpoint into the KPI cards.

---

## 4. Navigation Sidebar Links
- **Location**: `frontend/src/components/app-sidebar.tsx`
- **Current Behavior**:
  - The navigation sidebar menu items include Dashboard, Inbox, Auto-Reply Rules, Channels, Subscribers, Team, and Settings.
  - There is **no link** to `/dashboard/broadcasts` (Campaigns).
- **Recommendation**:
  - Add an item to the `items` array representing the Campaigns page:
    ```typescript
    { title: "الحملات الإعلانية", url: "/dashboard/broadcasts", icon: Megaphone }
    ```
    Importing `Megaphone` from `lucide-react` (which is already installed in the frontend dependencies).

---

## 5. Scheduled Broadcasts Execution Runner
- **Backend Analysis**:
  - There is **no background task runner or cron schedule** configured in the NestJS backend to automatically send scheduled broadcasts.
  - Currently, when a broadcast is scheduled, its status is updated to `SCHEDULED` in the database, but it remains unsent unless a user manually triggers the `POST /broadcasts/:id/execute` endpoint.
- **Recommendation**:
  - Install NestJS's standard schedule package: `@nestjs/schedule`.
  - Enable scheduling globally by importing `ScheduleModule.forRoot()` in `backend/src/app.module.ts`.
  - Add a minutely cron method in `BroadcastsService` using NestJS `@Cron('* * * * *')` to query all `SCHEDULED` campaigns whose `scheduledAt` is less than or equal to the current time, and automatically execute them.

---

## 6. Project Compilation & Testing
To ensure the project compiles and all tests run smoothly, use the following commands:

### Backend Build & Test
1. **Initialize Database** (run once to spin up Postgres and run migrations):
   ```powershell
   npm run db:init
   ```
2. **Build the NestJS Application** (compilation check):
   ```powershell
   npm run build
   ```
3. **Run Unit Tests**:
   ```powershell
   npm run test
   ```
4. **Run End-to-End Tests**:
   ```powershell
   npm run test:e2e
   ```

### Frontend Build
1. **Build Next.js Application** (compilation check):
   ```powershell
   npm run build
   ```

---

## 7. Concrete Scope of Work
A detailed step-by-step implementation guide has been generated in `SCOPE.md`. 

Key styling rules to follow:
- **Visual Design**: Accent colors must strictly utilize **Dark Neon Teal** (`#0ff5d4` / `var(--primary)`) and **Dark Neon Cyan** (`#00e5ff` / `var(--secondary)`). Violet/purple highlights must not be used.
- **Alerts**: Dialogs and toast notifications must utilize the custom `useConfirm` and `useToast` hooks from `frontend/src/components/ui/` to guarantee smooth, non-intrusive RTL overlays instead of standard browser popups.
