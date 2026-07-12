# Scope: M3_Broadcasts_Analytics (R6-R7)

## Architecture
- **Broadcasting & Scheduled Messages** (`frontend/src/app/dashboard/broadcasts`):
  - Campaign creation form (name, rich message content, target segments).
  - Scheduling logic (send now or schedule for specific date/time).
  - Status tracker UI: Draft -> Scheduled -> Sending -> Completed.
  - Delivery stats dashboard (sent count, delivered, read, clicked).
  - Target segment filters (by tags, platform, and subscription date range).
  - Paginated and filterable campaign lists.
- **Analytics Dashboard Upgrade** (`frontend/src/app/dashboard/page.tsx`):
  - Upgraded charts using Recharts:
    - Line chart: Messages sent/received over time.
    - Bar chart: Subscriber growth by day/week.
    - Donut chart: Platform distribution (Facebook vs WhatsApp vs Instagram).
  - Date Range Picker (Today, 7 days, 30 days, Custom range).
  - KPI cards with real trends (e.g., +12% from last week).
  - Remove redundant stats sections.

## Tasks
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Broadcast API & Models | Update schema/API in backend to store campaigns, status, scheduling, and stats | None | DONE |
| 2 | Broadcast Campaign UI | Build Campaign creation wizard, targets filter, and list view with status indicators | 1 | DONE |
| 3 | Date Range & KPIs | Create Date Range Picker and connect backend KPI queries with trends calculation | None | DONE |
| 4 | Recharts Charts | Render interactive Line, Bar, and Donut charts using Recharts on the dashboard | 3 | DONE |
| 5 | Segment Targeting | Map tag lists and platforms in scheduling targeting filter | 1, 2 | DONE |
| 6 | E2E & Layout Validation | Compile and verify broadcasting flows, scheduling cron triggers, and analytics layout | 2, 4, 5 | DONE |
