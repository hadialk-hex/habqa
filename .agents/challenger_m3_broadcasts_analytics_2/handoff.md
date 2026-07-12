# Handoff Report — Milestone 3 (Broadcasting & Analytics)

## 1. Observation

- **Silent Error Handling**: In `backend/src/broadcasts/broadcasts.service.ts` at lines 215–217:
  ```typescript
  } catch (err) {
    // Log/handle execute failure silently to not disrupt other executions
  }
  ```
- **Unhandled Database Query**: In `backend/src/broadcasts/broadcasts.service.ts` at lines 201–210:
  ```typescript
  async handleScheduledBroadcasts() {
    const now = new Date();
    const scheduled = await this.prisma.broadcast.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          lte: now,
        },
      },
    });
  ```
- **Failing Unit Test**: Command `npx jest src/challenger.spec.ts` failed with:
  ```
  Empirical Challenger M3 Test Suite › 2. Subscribers Module › create - should format tags correctly
  expect(jest.fn()).toHaveBeenCalledWith(...expected)
  - Expected: data without "platform"
  + Received: data containing "platform: null"
  ```
- **Frontend Chart Empty State & Resize**: In `frontend/src/app/dashboard/page.tsx` at lines 277–284:
  ```typescript
  const totalActivity = timelineData.reduce((acc: number, t: any) => acc + t.sent + t.received, 0)
  if (!isLoading && totalActivity === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm font-medium">
        لا يوجد نشاط مسجل في هذه الفترة.
      </div>
    )
  }
  ```
  And lines 286–287:
  ```html
  <div className="w-full h-64" dir="ltr">
    <ResponsiveContainer width="100%" height="100%">
  ```

---

## 2. Logic Chain

1. **Silent Failures**: The `catch (err)` block inside the scheduled execution loop does not invoke a logger or `console.error`. Consequently, if a background campaign fails (e.g., due to a database exception or missing Facebook/WhatsApp connection), it will fail without leaving any logs or diagnostics.
2. **Cron Scheduler Vulnerability**: The `this.prisma.broadcast.findMany` query is executed outside any `try-catch` wrapper. Thus, if a database timeout or connection error occurs at the moment of lookup, the scheduler throws an unhandled exception, halting execution of all scheduled campaigns for that run.
3. **Idempotency/Race Condition**: The `execute` method lacks validation checking for current campaign state (e.g., ensuring state is not already `SENT`). If overlapping cron executions occur or a user manually submits `POST /execute` concurrently, the same campaign will run multiple times, causing duplicate outgoing messages.
4. **Test Mismatch**: The subscribers unit test is asserting that `subscriber.create` is invoked without a `platform` field. However, the database schema/service includes `platform: null`, leading to a test regression.
5. **Chart Layout & empty states**:
   - The check `totalActivity === 0` correctly prevents drawing empty axes by displaying an informative empty-state message box.
   - Wrapping `<ResponsiveContainer>` in a fixed-height (`h-64`) block with full width (`w-full`) prevents vertical page reflow loop bugs common to Recharts while ensuring layout adaptivity on browser resize.

---

## 3. Caveats

- E2E tests (`test/broadcasts.e2e-spec.ts` and `test/adversarial-challenger.e2e-spec.ts`) could not be run locally using the custom SQLite wrapper because the command prompt for user permission timed out.
- Analysis of chart resize performance was performed statically; rendering glitches on specific minor viewport breakpoints (like extremely narrow screens < 320px) were not dynamically visualised.

---

## 4. Conclusion

The code implementation for Milestone 3 is structurally complete. The `GET /broadcasts` endpoint successfully implements JWT protection and tenant isolation. Recharts display, empty-state rendering, and layout scaling are properly configured on the dashboard. However, the background cron execution introduces **medium-risk vulnerabilities** due to unhandled db-query errors, swallowed exceptions (no logs generated), and a lack of execution state locks. Additionally, a pre-existing subscribers unit test is failing.

---

## 5. Verification Method

To verify these findings:
1. **Unit Test Failure**: Run `npx jest src/challenger.spec.ts` in the `backend` directory.
2. **Review Cron Exception handling**: Open `backend/src/broadcasts/broadcasts.service.ts` and inspect lines 200–220 to verify the lack of logs inside `handleScheduledBroadcasts`'s catch block, and the lack of a wrapper around `prisma.broadcast.findMany`.
3. **Check Chart empty state**: Review `frontend/src/app/dashboard/page.tsx` line 277–285 to confirm the zero-activity conditional fallback.
