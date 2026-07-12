## 2026-07-12T10:03:15Z
You are the Rules & Rich Messages Worker.
Your working directory is: c:\Users\pc\Desktop\face bot\.agents\worker_m2_rules\

Your task is to implement the backend database, NestJS APIs, and Next.js frontend components for Rules CRUD, Rich Messages, and Rules Analytics (Tasks 1, 2, and 3 in SCOPE.md).

MANDATORY INTEGRITY WARNING:
> DO NOT CHEAT. All implementations must be genuine. DO NOT
> hardcode test results, create dummy/facade implementations, or
> circumvent the intended task. A Forensic Auditor will independently
> verify your work. Integrity violations WILL be detected and your
> work WILL be rejected.

Here is the implementation plan:

### 1. Database Schema Update
- Edit `backend/prisma/schema.prisma` and add the following fields to the `AutoReplyRule` model:
  - `triggerCount    Int       @default(0)`
  - `lastTriggeredAt DateTime?`
  - `replyMessages   Json?` (to store the list of sequential messages)
- Run `npx prisma migrate dev --name add_metrics_and_rich_sequencing` inside the `backend/` directory to create and apply the migration.
- Verify the Prisma client is regenerated.

### 2. Backend Rules API Update
- Edit `backend/src/rules/dto/rules.dto.ts` to include `triggerCount`, `lastTriggeredAt`, and `replyMessages` in `CreateRuleDto` and `UpdateRuleDto`.
- Update `backend/src/rules/rules.service.ts` and `rules.controller.ts` so:
  - `create` and `update` methods support saving `replyMessages`.
  - The `trigger` method increments `triggerCount` and updates `lastTriggeredAt` in the database.
- Update `backend/src/webhooks/webhooks.service.ts` where auto-replies are executed (e.g. in `executeRule` or rules matching):
  - Increment `triggerCount` and update `lastTriggeredAt` upon match.
  - Implement sequential message sending if `replyMessages` is defined (loop with delays/timeouts). If it's not defined, fall back to legacy `replyText`/`replyMedia` fields.

### 3. Frontend Rules Page Upgrade (`frontend/src/app/dashboard/rules/page.tsx`)
- **Add Rule Editing**:
  - Add an edit button on the rule cards (using the Edit icon from lucide-react).
  - Open the rule dialog with all state fields pre-populated when clicked.
  - Call `PUT /rules/:id` on submission when in edit mode, and reset the form/state when done.
- **Rich Message Sequence Builder**:
  - Add a switch in the form: "تفعيل الردود المتسلسلة (إرسال عدة رسائل)".
  - When active, show a sequence editor allowing 2 to 5 messages.
  - Implement zero-dependency drag-and-drop (using HTML5 events or index reordering buttons) to reorder messages.
  - For each message, support types: TEXT (with spin-tax split by `|||`), IMAGE (caption + image URL), CAROUSEL (cards list, each with title, subtitle, imageUrl, and up to 3 buttons of type url/postback), and QUICK_REPLIES (text prompt + list of reply chips with titles and payloads).
- **Mobile Phone Preview**:
  - Render a simulated phone container to the side or inside the dialog.
  - Include platform toggles (Messenger / WhatsApp) that render the message sequence in real time using Tailwind CSS to match the style of the chosen platform.
- **Rules Analytics Display**:
  - In each rule card, display the trigger count and last triggered date (formatted nicely in Arabic).
- **Predefined Templates Library**:
  - Add a button "مكتبة القوالب الجاهزة" that opens a templates modal.
  - Define at least 3 templates (e.g. "استفسار السعر", "ترحيب بالعملاء", "ساعات العمل").
  - Clicking a template should pre-populate the form and open the editor dialog.

### 4. Build and Test Verification
- Run `npm run build` or `npx tsc --noEmit` in both frontend and backend to ensure zero TypeScript errors.
- Run `node run-tests-sqlite-fixed.js` in the backend to ensure tests pass.

Write a complete report of your changes and test outcomes to `c:\Users\pc\Desktop\face bot\.agents\worker_m2_rules\handoff.md` and send a message when done.
