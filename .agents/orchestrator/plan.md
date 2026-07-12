# Execution Plan: Hubqa RTL Dark Neon SaaS Overhaul (R1-R9)

This plan decomposes the urgent pivot requirements (R1-R9) into 4 major milestones. We prioritize the design system first (R1-R3) to establish a clean base, and then implement the individual page features (R4-R9).

## Milestones and Status

- [ ] **M1: Design Overhaul & UI Integrity (R1-R3)**
  - Rewrite `frontend/src/app/globals.css` to define the Neon Teal (#0ff5d4) / Cyan (#00e5ff) visual accents on deep dark backgrounds (#0a0a0f / #0d1117).
  - Search and purge all purple/magenta colors (`purple`, `violet`, hue `275-310`) in the frontend workspace.
  - Implement a custom confirmation dialog component and custom toasts to replace browser `alert()` and `confirm()` calls.
  - Eliminate all `window.location.reload()` calls and replace them with react state refreshes or route revalidation.
  - Fix dropdown/select overflow and z-index ordering (Select portals using `z-50` and Dialogs stacking context).
  - Ensure horizontal scroll for tabs on mobile in the admin pages.

- [ ] **M2: Advanced Rules & Flow Builder (R4-R5)**
  - Upgrade the Rules Builder page (`/dashboard/rules`):
    - Implement editing capability for existing rules.
    - Support multiple response types (Text, Image with caption, Carousel/Cards with buttons, Quick Reply buttons).
    - Enable message chaining (2-5 sequential responses per rule) with drag-to-reorder sequences.
    - Build a visual message preview mimicking Facebook/WhatsApp.
    - Add rule trigger count and last-triggered date analytics, and a templates library.
  - Implement the Flow Builder page (`/dashboard/flows`):
    - Design trigger nodes, action nodes, and condition nodes.
    - Use SVG or ReactFlow to construct clean visual connections between nodes.
    - Support Saving/Activating/Deactivating flows.

- [ ] **M3: Broadcasting & Advanced Analytics (R6-R7)**
  - Create the Broadcasting page (`/dashboard/broadcasts`):
    - Form to create campaigns (name, target segments, rich message content).
    - Schedule for specific date/time or send immediately.
    - Status tracker (Draft -> Scheduled -> Sending -> Completed) and delivery metrics (sent, delivered, read, clicked).
    - Filter campaigns list with pagination.
  - Upgrade the Analytics Dashboard (`/dashboard/page.tsx`):
    - Integrate a Date Range Picker.
    - Create interactive Recharts charts: Line chart (messages), Bar chart (subscribers), Donut chart (platforms).
    - Upgrade KPI cards with trend indicators and remove redundant quick stats.

- [ ] **M4: Subscribers & Inbox Upgrade (R8-R9)**
  - Upgrade Subscriber Management (`/dashboard/subscribers`):
    - Replace fake pagination with true server-side pagination.
    - Build tag manager, filter segments, and bulk action toolbar (bulk tag/export/delete).
    - Build the subscriber profile drawer displaying metadata, tags, and full conversation history.
    - Connect the CSV export button.
  - Upgrade the Professional Inbox (`/dashboard/inbox`):
    - Render real-time conversation preview with the actual last message.
    - Implement status toggle (Open / Resolved / Snoozed) and team assignment dropdown.
    - Support canned responses insertion, rich messages, and automatic scroll-to-bottom.
    - Remove/replace dead buttons (inbox phone, video, emoji, attachments).
