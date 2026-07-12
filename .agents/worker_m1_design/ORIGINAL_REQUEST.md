## 2026-07-12T09:36:08Z
You are the Worker for Milestone 1: Design Overhaul (R1-R3).
Your working directory is `c:\Users\pc\Desktop\face bot\.agents\worker_m1_design\`.

Your task is to implement all changes required for Milestone 1 (R1-R3) based on the recommendations from Explorers 1, 2, and 3:

### 1. Implement Theme and Colors (Task 1 & 2):
- Update `frontend/src/app/globals.css` with the custom Dark Neon theme variables under the `.dark` class, glassmorphic card utilities, custom glow utilities, and keyframe animations as detailed in:
  `c:\Users\pc\Desktop\face bot\.agents\explorer_r1_r3_1\analysis.md`
- Purge purple/indigo/rose/pink color classes from:
  1. `frontend/src/app/admin/page.tsx`
  2. `frontend/src/app/page.tsx`
  Refer to `c:\Users\pc\Desktop\face bot\.agents\explorer_r1_r3_1\analysis.md` Section 2 for exact line-by-line replacement lists.

### 2. Implement Custom Dialogs, Toast, and Context (Task 3 & 5):
- Create the custom React Toast component file at `frontend/src/components/ui/toast.tsx`.
- Create the custom Promise-based Confirmation Dialog Modal component file at `frontend/src/components/ui/confirm-dialog.tsx`.
- Modify `frontend/src/lib/auth-context.tsx` to expose `updateUser(fields: Partial<User>)` which mutates user state and updates local storage.
- Modify `frontend/src/app/layout.tsx` to import and wrap the application layout with `ToastProvider` and `ConfirmProvider`.
- Replace native `window.alert()`, `window.confirm()`, and `window.location.reload()` calls across the frontend as detailed in `c:\Users\pc\Desktop\face bot\.agents\explorer_r1_r3_2\analysis.md` Section 4. Specifically:
  1. `frontend/src/app/dashboard/settings/page.tsx` (Replace all alerts with toasts, and reloads with updateUser).
  2. `frontend/src/app/dashboard/inbox/page.tsx` (Replace alerts with toasts).
  3. `frontend/src/app/dashboard/rules/page.tsx` (Replace confirm with confirm dialog).
  4. `frontend/src/app/dashboard/team/page.tsx` (Replace confirm with confirm dialog).
  5. `frontend/src/app/admin/page.tsx` (Replace confirm with confirm dialog).

### 3. Implement Layout, Stacking & Overflow fixes (Task 4 & 6):
- Update `DropdownMenuContent` z-index to `z-[100]` and `TooltipContent` z-index to `z-[150]` in their UI files:
  1. `frontend/src/components/ui/dropdown-menu.tsx`
  2. `frontend/src/components/ui/tooltip.tsx`
- Update the layout on the Admin page tabs list (`frontend/src/app/admin/page.tsx` line 339) to be responsive and scrollable on mobile as recommended:
  `flex overflow-x-auto no-scrollbar md:grid md:grid-cols-6` and add `shrink-0` to the tab triggers.
- Extract the `Pagination` component from inside the `AdminPage` render function to the file level (top/bottom) of `frontend/src/app/admin/page.tsx` to fix ESLint errors.

### Verification Requirements:
- After applying the changes, run the following verification checks inside the `frontend` folder:
  1. TypeScript checks: `npx tsc --noEmit`
  2. Lint checks: `npm run lint`
  3. Next.js build: `npm run build`
- All checks must pass with zero compilation, type, or lint errors.
- Document the commands, outputs, and any adjustments in your handoff report.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your handoff report to `c:\Users\pc\Desktop\face bot\handoff.md` (or your agents folder).
Send a message back to your parent when done.
