# Implementation Proposal Plan (Milestone 3: Broadcasting & Analytics)

This document outlines a concrete implementation plan for the subagent to overhaul the Broadcasting and Analytics features.

---

## 🔒 Design constraints & Theme
1. **No Purple/Violet Colors**: Accent colors must strictly be **Dark Neon Teal/Cyan** (`#0ff5d4` / `#00e5ff`) matching `var(--primary)` and `var(--secondary)`.
2. **Alerts & Dialogs**: Avoid `window.alert` and `window.confirm`. Use the project's native `useToast` and `useConfirm` contexts for all alerts, notifications, and operation confirmations.

---

## Task 1: Broadcasts backend endpoint & schema
### Backend Changes
1. **Service Method**:
   Add a `findAll` method in `backend/src/broadcasts/broadcasts.service.ts`:
   ```typescript
   async findAll(tenantId: string) {
     return this.prisma.broadcast.findMany({
       where: { tenantId },
       orderBy: { createdAt: 'desc' },
     });
   }
   ```
2. **Controller Endpoint**:
   Add a `@Get()` endpoint in `backend/src/broadcasts/broadcasts.controller.ts`:
   ```typescript
   @Get()
   @HttpCode(HttpStatus.OK)
   async findAll(@Request() req: any) {
     return this.broadcastsService.findAll(req.user.tenantId);
   }
   ```
3. **Database Schema**:
   Confirm that the `Broadcast` model in `backend/prisma/schema.prisma` contains the following fields:
   - `id`, `tenantId`, `name`, `content`, `segmentTarget`, `status` (enum `CampaignStatus`), `scheduledAt`, `sentCount`, `deliveredCount`, `createdAt`, `updatedAt`.
   *(No changes to Prisma models are required as this model is already present).*

---

## Task 2: Analytics stats endpoint enhancement
### Backend Changes
1. **Query DTO**:
   Create a DTO in `backend/src/dashboard/dto/dashboard.dto.ts` (or extend/rename existing):
   ```typescript
   import { IsOptional, IsString, IsEnum } from 'class-validator';

   export class GetStatsDto {
     @IsOptional()
     @IsString()
     range?: 'today' | '7days' | '30days' | 'custom';

     @IsOptional()
     @IsString()
     startDate?: string;

     @IsOptional()
     @IsString()
     endDate?: string;
   }
   ```
2. **Controller update**:
   Enhance `backend/src/dashboard/dashboard.controller.ts` to accept the query parameter:
   ```typescript
   @Get('stats')
   async getStats(@Request() req: any, @Query() dto: GetStatsDto) {
     return this.dashboardService.getStats(req.user.tenantId, dto);
   }
   ```
3. **Service Logic (Trend calculation)**:
   In `backend/src/dashboard/dashboard.service.ts`, calculate the date boundaries for the **Current Period** and **Previous Period** based on the query:
   - **Range definitions**:
     - `today`: Current (today 00:00:00 to 23:59:59), Previous (yesterday 00:00:00 to 23:59:59).
     - `7days`: Current (last 7 days), Previous (preceding 7 days).
     - `30days`: Current (last 30 days), Previous (preceding 30 days).
     - `custom`: Current (`startDate` to `endDate`), Previous (same duration immediately preceding `startDate`).
   - **Calculating trends**:
     For each of the KPI metrics, run queries for the current and previous periods and calculate:
     $$\text{trendPercentage} = \frac{\text{Current} - \text{Previous}}{\text{Previous}} \times 100$$
     *(If Previous is 0, return 100 if Current > 0, else 0)*.
   - **Metrics to track**:
     - **Subscribers**: Count of `Subscriber` records created in the period.
     - **Auto Replies**: Count of outbound `Message` records sent in the period.
     - **Active Conversations**: Count of open `Conversation` records active/created in the period.
     - **Active Rules**: Count of active `AutoReplyRule` records (or executions in the period).
   - Return metrics inside `stats` as:
     ```json
     {
       "totalSubscribers": 120,
       "subscribersTrend": 12.5,
       "totalAutoReplies": 1420,
       "autoRepliesTrend": -2.3,
       "activeConversations": 18,
       "conversationsTrend": 5.0,
       "totalRules": 8,
       "rulesTrend": 0.0,
       "timeline": [...]
     }
     ```

---

## Task 3: Dashboard homepage & Recharts integration
### Frontend Changes
1. **Install Dependencies**:
   Install `recharts` package in `frontend/package.json` to draw clean, modern neon graphs.
2. **Dashboard UI Updates (`frontend/src/app/dashboard/page.tsx`)**:
   - Add a date range selector at the top (dropdown or tabs for: اليوم, ٧ أيام, ٣٠ يوم, مخصص).
   - Fetch backend `/dashboard/stats` endpoint with selected query parameters on filter change.
   - Parse and render the calculated trend percentages inside the KPI cards using `TrendingUp` (with neon green/teal text) and `TrendingDown` (with red text).
   - Replace the custom HTML-based bar chart with a beautiful Recharts `AreaChart` or `BarChart` matching the Dark Neon theme:
     - Use a gradient with `#0ff5d4` (Teal) and `#00e5ff` (Cyan) for the area filling.
     - Add a neon drop-shadow glow using Tailwind class `glow-teal`.

---

## Task 4: Navigation Sidebar link
### Frontend Changes
1. **Sidebar Navigation Update (`frontend/src/components/app-sidebar.tsx`)**:
   Import `Megaphone` from `lucide-react`.
   Add a link to the campaigns view inside the `items` array:
   ```typescript
   const items = [
     { title: "الرئيسية", url: "/dashboard", icon: LayoutDashboard },
     { title: "صندوق الوارد", url: "/dashboard/inbox", icon: Inbox },
     { title: "قواعد الرد الآلي", url: "/dashboard/rules", icon: MessageSquareText },
     { title: "الحملات الإعلانية", url: "/dashboard/broadcasts", icon: Megaphone }, // Added
     { title: "قنوات التواصل", url: "/dashboard/channels", icon: Share2 },
     { title: "المشتركون", url: "/dashboard/subscribers", icon: Users },
     { title: "الفريق", url: "/dashboard/team", icon: UserCog },
     { title: "الإعدادات", url: "/dashboard/settings", icon: Settings },
   ]
   ```

---

## Task 5: Background scheduler/cron setup
### Backend Changes
1. **Install NestJS Schedule package**:
   In `backend/package.json`, add `@nestjs/schedule` dependency.
2. **Register Schedule module**:
   Import and register `ScheduleModule.forRoot()` in `backend/src/app.module.ts`.
3. **Execution Cron Job**:
   Implement a cron job in `backend/src/broadcasts/broadcasts.service.ts` (or a dedicated runner service) that triggers every minute:
   ```typescript
   import { Cron, CronExpression } from '@nestjs/schedule';

   @Cron(CronExpression.EVERY_MINUTE)
   async handleScheduledBroadcasts() {
     const now = new Date();
     const pendingBroadcasts = await this.prisma.broadcast.findMany({
       where: {
         status: 'SCHEDULED',
         scheduledAt: { lte: now },
       },
     });

     for (const broadcast of pendingBroadcasts) {
       try {
         await this.execute(broadcast.tenantId, broadcast.id);
       } catch (err) {
         // Log execution error
         console.error(`Failed to execute broadcast ${broadcast.id}:`, err);
       }
     }
   }
   ```
