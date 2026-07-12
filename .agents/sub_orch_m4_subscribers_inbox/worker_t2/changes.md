# Changes Log

## Backend Changes

### 1. Database Schema
- **File**: `backend/prisma/schema.prisma`
- **Details**:
  - Added `assignedToId String?` and `assignedTo User? @relation(fields: [assignedToId], references: [id], onDelete: SetNull)` to `Conversation` model.
  - Added the corresponding back-relation `assignedConversations Conversation[]` to `User` model.
  - Added `@@index([assignedToId])` to speed up assignee lookups.
  - Sync'd schema with database using `npx prisma db push`.

### 2. Subscribers Module
- **Files**:
  - `backend/src/subscribers/subscribers.service.ts`
  - `backend/src/subscribers/subscribers.controller.ts`
- **Details**:
  - Added `GET /subscribers/:id/conversation` endpoint to find the conversation record matching the subscriber's phone or email or name or ID, and returned the conversation history along with its messages sorted chronologically.

### 3. Inbox Module
- **Files**:
  - `backend/src/inbox/inbox.service.ts`
  - `backend/src/inbox/inbox.controller.ts`
- **Details**:
  - Updated `getConversations` query in `InboxService` to include the `assignedTo` assignee relationship, and also included `messages` limited to the latest 1 message for sidebar preview.
  - Added a PATCH endpoint `PATCH /inbox/conversations/:id/assign` to update the `assignedToId` of a conversation with tenant member validation.

### 4. E2E Tests
- **File**: `backend/test/inbox.e2e-spec.ts`
- **Details**:
  - Added test case verifying retrieval of subscriber's conversation history (`GET /subscribers/:id/conversation`).
  - Added test case verifying assignment of conversation to a team member (`PATCH /inbox/conversations/:id/assign`).

---

## Frontend Changes

### 1. Subscribers Page
- **File**: `frontend/src/app/dashboard/subscribers/page.tsx`
- **Details**:
  - Preserved intact all user manual pagination, inline tag add/remove, and tags/platform filtering.
  - Integrated `Sheet` profile drawer component from `@/components/ui/sheet`.
  - Row click now opens the profile drawer.
  - The drawer displays full subscriber info and fetches their conversation history from the new backend endpoint, showing formatted messages.
  - Integrated full CSV export for matching subscribers using search queries and filters on the "تصدير البيانات" button.

### 2. Inbox Page
- **File**: `frontend/src/app/dashboard/inbox/page.tsx`
- **Details**:
  - Configured `messagesEndRef` scroll anchor to automatically scroll to the bottom on new messages.
  - Added support for sending and rendering rich messages: image URLs (rendered as standard images) and quick replies (rendered as clickable suggestion buttons).
  - Replaced all dead header buttons (phone/video calls) and input buttons (emoji picker/attachment menu) with active interactive layouts (such as real emoji insertion grid, preset attachment injection, and help toasts).
  - Added a canned responses insert menu next to the message input populated with common Arabic responses.
  - Added status toggles ('مفتوحة', 'محلولة', 'مؤجلة') in the active chat header that patch the status via `PATCH /inbox/conversations/:id/read`.
  - Added assignee dropdown to dynamically fetch team members from `GET /team/members` and update the assignment via `PATCH /inbox/conversations/:id/assign`.
  - Replaced the sidebar "اضغط لعرض تفاصيل المحادثة" preview string with the actual latest message content.
  - Implemented correct RTL layout structures and message alignments for inbound vs outbound messages.
