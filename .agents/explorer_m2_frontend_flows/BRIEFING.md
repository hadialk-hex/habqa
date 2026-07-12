# BRIEFING — 2026-07-12T10:04:00Z

## Mission
Analyze and recommend an architecture/implementation plan for the visual node-based flow builder in the frontend dashboard.

## 🔒 My Identity
- Archetype: explorer
- Roles: Frontend Flow Builder Explorer
- Working directory: c:\Users\pc\Desktop\face bot\.agents\explorer_m2_frontend_flows\
- Original parent: fbde584b-5190-4361-b9f4-22926f0aa15f
- Milestone: Milestone 2

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Analyze how to build a visual node-based flow builder at c:\Users\pc\Desktop\face bot\frontend\src\app\dashboard\flows\
- Support required node types: Triggers, Actions, Conditions
- Draw animated visual connection lines
- Handle saving, activating, and deactivating flows via APIs

## Current Parent
- Conversation ID: fbde584b-5190-4361-b9f4-22926f0aa15f
- Updated: not yet

## Investigation State
- **Explored paths**:
  - Checked frontend framework, packages, and dependencies in `frontend/package.json`. Next.js 16/React 19 Tailwind project.
  - Checked existing page layouts and templates (e.g. `app/dashboard/layout.tsx` and `app/dashboard/rules/page.tsx`).
  - Reviewed database schema in `backend/prisma/schema.prisma` and identified existing `Flow`, `FlowTrigger`, `FlowStep`, `FlowBranch`, `FlowExecution` and `FlowExecutionLog` models.
  - Checked NestJS rules controllers and services to map the API design conventions.
- **Key findings**:
  - Found that `@xyflow/react` (React Flow v12) is the optimal, native choice for React 19 visual canvas.
  - Visual connections should use SVG animated stroke properties for flow visualization.
  - Detailed node properties for Triggers, Actions, and Conditions map well to the Prisma relational schema using the JSON `metadata` field for UI positions and JSON `configuration` for step details.
  - Serializing canvas nodes and edges to database tables can be structured via a hierarchical API request payload.
- **Unexplored areas**:
  - Full backend automation engine controller/service implementation (this is backend-focused, so it's out of scope for frontend explorer but we provide API specifications).

## Key Decisions Made
- Recommend using `@xyflow/react` version 12 to resolve React 19 compatibility.
- Utilize database `metadata` for UI canvas positioning, and `configuration`/`branches` in `FlowStep` for mapping `@xyflow/react` edges.

## Artifact Index
- c:\Users\pc\Desktop\face bot\.agents\explorer_m2_frontend_flows\ORIGINAL_REQUEST.md — Original task description
- c:\Users\pc\Desktop\face bot\.agents\explorer_m2_frontend_flows\handoff.md — Detailed analysis report
