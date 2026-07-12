## Challenge Summary

**Overall risk assessment**: CRITICAL

## Challenges

### [Critical] Challenge 1: Double-Execution / Delivery Race Condition in Campaign Scheduler

- **Assumption challenged**: Campaigns with status `SCHEDULED` are executed exactly once because their status is updated to `SENT` upon execution.
- **Attack scenario**: If a scheduled campaign targets a large subscriber segment and its execution takes longer than 1 minute, the minutely cron job will fire again. Since the database status remains `SCHEDULED` until the very end of the `execute()` process, the second cron run fetches the same campaign and executes it in parallel, leading to duplicate delivery.
- **Blast radius**: Multi-delivery of broadcast messages. Subscribed customers receive duplicate messages, causing channel spam, potential rate-limiting/bans on Meta APIs, and increased infrastructure/API costs.
- **Mitigation**: Update the campaign status to `PROCESSING` (or a similar intermediate state) at the beginning of the `execute()` method or use database locking (e.g., SELECT FOR UPDATE) to ensure atomicity.

### [Medium] Challenge 2: Sequential instead of Concurrent Scheduled Campaign Execution

- **Assumption challenged**: If multiple campaigns are scheduled at the same time, the minutely cron executes them concurrently.
- **Attack scenario**: The cron loop uses sequential `await` in a `for...of` loop:
  ```typescript
  for (const b of scheduled) {
    try {
      await this.execute(b.tenantId, b.id);
    } catch (err) {}
  }
  ```
- **Blast radius**: Execution delays. If Campaign A has thousands of subscribers and takes 5 minutes to complete, Campaign B (scheduled at the same time) is blocked and will start 5 minutes late.
- **Mitigation**: Execute them concurrently using `Promise.all()` or `Promise.allSettled()`, or delegate execution to a background queue system like BullMQ.

### [Medium] Challenge 3: Inverted Trend Calculation Math on Negative Inputs

- **Assumption challenged**: The dashboard analytics trend percentage calculations are robust for all numeric inputs.
- **Attack scenario**: If counts are negative, the trend percentage direction is inverted:
  - Going from `-5` to `-10` (a decrease) yields `+100.0%` trend.
  - Going from `-10` to `-5` (an increase) yields `-50.0%` trend.
- **Blast radius**: Misleading metrics display. Although current DB count queries return non-negative integers, any negative input leads to mathematically inverted trends.
- **Mitigation**: Enforce absolute calculations or add validation logic to restrict trend calculations to non-negative values.

### [Low] Challenge 4: Frontend Silent Error on Invalid Date Range Selection

- **Assumption challenged**: The frontend date range picker handles invalid states (e.g. `startDate > endDate`) gracefully.
- **Attack scenario**: If the user selects a custom date range where `startDate > endDate`, the backend returns `400 Bad Request`. The frontend catches this in the fetch block and logs to console, but fails to show any user-facing error message or toast, leaving the dashboard in a confusing, un-updated state.
- **Blast radius**: Poor user experience. Users receive no feedback about their invalid input.
- **Mitigation**: Show an error toast or validation banner when the analytics fetch request fails.

## Stress Test Results

- **Previous = 0, Current = 0** → Should return `0.0` → Returns `0` → **PASS**
- **Previous = 0, Current > 0** → Should return `100.0` → Returns `100` → **PASS**
- **Previous = 1, Current = MAX_SAFE_INTEGER** → No overflow crash → Returns large trend → **PASS**
- **Sequential Execution Test** → B2 starts after B1 finishes → Starts sequentially → **PASS (Empirically Confirmed)**
- **Double Execution Race Condition** → Cron fired twice on long execution → Campaign executed twice → **PASS (Empirically Confirmed Vulnerability)**

## Unchallenged Areas

- **Frontend Recharts AreaChart visual style** — Reason: Out of scope (focused on behavioral and mathematical correctness).
