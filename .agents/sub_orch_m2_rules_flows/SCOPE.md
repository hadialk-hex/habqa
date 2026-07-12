# Scope: M2_Rules_Flows (R4-R5)

## Architecture
- **Rules Page Upgrade** (`frontend/src/app/dashboard/rules`):
  - Support editing existing rules.
  - Enrich response types: Text, Image with caption, Carousel/Cards with buttons (URL + Postback), and Quick Reply buttons.
  - Sequential responses (2-5 messages per rule) with drag-to-reorder sequences.
  - Visual preview of messages (representing how they look on Facebook/WhatsApp).
  - Rule trigger metrics (trigger count, last-triggered date).
  - Templates library for saving/reusing rules.
- **Node Flow Builder** (`frontend/src/app/dashboard/flows`):
  - Graphical node-based builder UX using SVG or a clean canvas layout (ReactFlow or custom).
  - Nodes: Trigger nodes (Keyword match, New subscriber, Comment on post, Any message), Action nodes (Send message, Add/Remove tag, Notify team, Wait/Delay), Condition nodes (Tag check, Platform check, Time check).
  - Draw animated visual connections between nodes.
  - Support saving, activating, and deactivating flows.

## Tasks
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Rule CRUD & Edit | Extend rules CRUD API in backend and edit form in frontend rules page | None | PLANNED |
| 2 | Rich Messages UI | Build message editor with captions, carousel cards, and drag-and-drop sequencing | 1 | PLANNED |
| 3 | Rules Analytics & Library | Track trigger stats in database, show trigger counters in UI, and add a template loader | 1 | PLANNED |
| 4 | Flow Nodes & Canvas | Create Node Flow Builder UI layout at /dashboard/flows with node templates | None | PLANNED |
| 5 | Flow Connections & Save | Implement node line-drawing connections and save/activate/deactivate flow endpoints | 4 | PLANNED |
| 6 | E2E & Visual Verification | Run build/test to verify rules editing and flow builder visual rendering | 2, 3, 5 | PLANNED |
