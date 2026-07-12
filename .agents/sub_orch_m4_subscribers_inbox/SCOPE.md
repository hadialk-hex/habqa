# Scope: M4_Subscribers_Inbox (R8-R9)

## Architecture
- **Subscriber Management** (`frontend/src/app/dashboard/subscribers`):
  - True server-side pagination (fixing fake pagination).
  - Tag system: Add/remove colored tags on subscribers.
  - Saved segments (filter presets like "Active Facebook users").
  - Subscriber profile drawer: Full conversation history, tags, platform, and date metrics.
  - Bulk actions toolbar: Select multiple to tag, export (CSV), or delete.
  - Search and filter bar (by name, platform, tag, subscription date range).
  - Platform detection based on channel, not guess heuristics.
- **Professional Inbox Upgrade** (`frontend/src/app/dashboard/inbox`):
  - Send rich messages: Text, images, quick replies.
  - Conversation status toggle: Open / Resolved / Snoozed.
  - Assign conversation to team members.
  - Canned responses insert tool.
  - Automatic scroll-to-bottom on new messages.
  - Real-time conversation thread preview showing the actual last message.
  - Correct RTL alignment and layouts for outbound messages.
  - Clean up dead buttons (phone, video, emoji, attachment) with active mock actions or tools.

## Tasks
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | True Pagination & Tags | Fix pagination endpoint, add backend tags schema/endpoints, and tag manager UI | None | PLANNED |
| 2 | Profile Drawer & CSV | Build subscriber profile drawer with thread logs, and export subscriber list to CSV | 1 | PLANNED |
| 3 | Rich Messaging & Scroll | Upgrade inbox message feed with auto-scroll and image/button attachments | None | PLANNED |
| 4 | Conversation Status & Team | Add status toggles (Open/Resolved) and conversation assignee dropdown | 3 | PLANNED |
| 5 | Canned Responses & Preview | Create canned responses dictionary and update chat sidebar with actual last message text | 3 | PLANNED |
| 6 | E2E & RTL Validation | Compile and verify subscriber operations, bulk actions, and RTL chat alignments | 2, 4, 5 | PLANNED |
