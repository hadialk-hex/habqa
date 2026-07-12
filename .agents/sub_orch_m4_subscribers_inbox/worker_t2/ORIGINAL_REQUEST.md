## 2026-07-12T11:51:20Z
You are a Worker agent. Implement Tasks 2 to 5 for Milestone 4: Subscribers & Inbox Upgrade (R8-R9).

Your working directory is `c:\Users\pc\Desktop\face bot\.agents\sub_orch_m4_subscribers_inbox\worker_t2\`.

CRITICAL DIRECTIVE: The user has manually contributed to `frontend/src/app/dashboard/subscribers/page.tsx` to add server-side pagination, tag filtering, and inline tag addition. You must verify these changes, preserve them intact, and coordinate any integration safely. Do NOT overwrite these user changes.

Detailed requirements:

1. **Subscriber Profile Drawer & CSV Export (Task 2)**:
   - In `frontend/src/app/dashboard/subscribers/page.tsx`:
     - When clicking on a subscriber row, open a Sheet (`Sheet` from `@/components/ui/sheet` or similar drawer) acting as a profile drawer.
     - The profile drawer must show the subscriber details: platform type, email, phone, tags (with inline add/remove), and their "Full conversation history" (thread logs).
     - To fetch this conversation history, implement a backend endpoint `GET /subscribers/:id/conversation` in `subscribers.controller.ts` and `subscribers.service.ts` that finds the `Conversation` record matching the subscriber's phone or email or name or ID (or has similar customerId), and returns it along with its messages (`this.prisma.message.findMany`).
     - Enable the "Download CSV" / "تصدير البيانات" button to fetch all subscribers (using current search query and filters) and export/download them as a CSV file.
   
2. **Rich Messaging & Scroll (Task 3)**:
   - In `frontend/src/app/dashboard/inbox/page.tsx`:
     - Ensure the message feed container automatically scrolls to the bottom on new messages.
     - Support sending rich messages (text, image URLs, quick replies) from the chat text area. Implement attachment actions or buttons that show working mock dialogs/toasts (no dead buttons).
     - Replace all dead buttons (phone, video, emoji, attachment) with active mock actions (like a custom confirmation dialog/toast or opening a small emoji popover/picker mock).

3. **Conversation Status & Team Assignment (Task 4)**:
   - Update `backend/prisma/schema.prisma` to add assignee functionality:
     - Add `assignedToId String?` and `assignedTo User? @relation(fields: [assignedToId], references: [id], onDelete: SetNull)` to `Conversation` model.
     - Add the corresponding back-relation `assignedConversations Conversation[]` to `User` model.
     - Run `npx prisma db push` to push this schema update to the database.
   - Update `backend/src/inbox/inbox.controller.ts` and `backend/src/inbox/inbox.service.ts`:
     - Add a PATCH endpoint `PATCH /inbox/conversations/:id/assign` to update the `assignedToId` of a conversation.
     - Ensure `getConversations` returns the assignee information (e.g. `include: { connection: true, assignedTo: true }`).
   - In `frontend/src/app/dashboard/inbox/page.tsx`:
     - Add conversation status toggles in the active chat header: 'Open' (مفتوحة), 'Resolved' (محلولة), 'Snoozed' (مؤجلة). Change status by patching the status via `PATCH /inbox/conversations/:id/read`.
     - Add an assignee dropdown in the active chat header. Fetch the list of team members from `GET /team/members` and display them. Selecting a member updates the assignee via `PATCH /inbox/conversations/:id/assign`.

4. **Canned Responses & Sidebar Preview (Task 5)**:
   - In `frontend/src/app/dashboard/inbox/page.tsx`:
     - Create a canned responses insert tool next to the message input (a selection popup or quick insert menu in Arabic, e.g. "مرحباً! كيف يمكنني مساعدتك؟", "شكراً لتواصلك معنا.", "جاري تحويلك للمختص."). Clicking a response inserts it into the text area.
     - Update the chat sidebar conversation items to show the actual last message content instead of "اضغط لعرض...".
     - Ensure correct RTL layout and alignments for inbound vs outbound messages (Arabic messages text align right/left with appropriate bubble color/corners).

5. **Verify everything**:
   - Build backend (`npm run build` inside `backend/`) and ensure there are no compilation errors.
   - Build frontend (`npm run build` inside `frontend/`) and ensure there are no compilation errors.
   - Run backend E2E tests (`npm run test:e2e` inside `backend/`) to verify all tests pass without regressions. Note: If Jest hangs or fails to exit, run it with `--forceExit` or check for hanging processes and terminate them.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Save your results in `changes.md` and write a detailed `handoff.md`. Send a message back when completed.
