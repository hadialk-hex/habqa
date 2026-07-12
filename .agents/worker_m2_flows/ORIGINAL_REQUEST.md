## 2026-07-12T12:02:24Z
You are the Flow Builder Worker.
Your working directory is: c:\Users\pc\Desktop\face bot\.agents\worker_m2_flows\

Your task is to implement the backend NestJS module, APIs, and the frontend interactive flow builder canvas page at /dashboard/flows (Tasks 4 and 5 in SCOPE.md).

MANDATORY INTEGRITY WARNING:
> DO NOT CHEAT. All implementations must be genuine. DO NOT
> hardcode test results, create dummy/facade implementations, or
> circumvent the intended task. A Forensic Auditor will independently
> verify your work. Integrity violations WILL be detected and your
> work WILL be rejected.

Here is the implementation plan:

### 1. Backend Flows Module & APIs
- Create `backend/src/flows` module folder containing:
  - `dto/flows.dto.ts` defining `SaveFlowDto` containing triggers, steps, and branches.
  - `flows.service.ts` implementing:
    - `getFlows(tenantId: string)`: returns all flows for the tenant.
    - `getFlow(id: string, tenantId: string)`: returns full flow details including triggers, steps, and branches.
    - `saveFlow(id: string | undefined, tenantId: string, dto: SaveFlowDto)`: uses a transaction to update/create the Flow record, delete old triggers/steps (which cascades delete branches), and create the new triggers/steps/branches. Preserve the step UUIDs sent by the frontend editor.
    - `toggleActive(id: string, tenantId: string, isActive: boolean)`: updates Flow activation status.
    - `deleteFlow(id: string, tenantId: string)`: deletes the flow.
  - `flows.controller.ts` providing CRUD routes mapping to service methods (guarded by `JwtAuthGuard`).
  - `flows.module.ts` exposing `FlowsService` and importing `PrismaModule`.
- Import and register `FlowsModule` in `backend/src/app.module.ts`.

### 2. Frontend Flow Builder Page `/dashboard/flows`
- Create `frontend/src/app/dashboard/flows/page.tsx` as the main flow builder editor.
- Since this is React 19/Next.js 16 in a potentially offline code-only environment, you can install `@xyflow/react` OR build a custom interactive SVG/HTML5 flow canvas:
  - If using `@xyflow/react` v12, run npm install using `--legacy-peer-deps` or defensive commands.
  - If you encounter network/offline issues, build a custom React SVG-based drag-and-drop node canvas. A custom node canvas renders nodes at relative `{x,y}` states, draws connections using SVG `<path>` bezier curves, implements drag movement via mouse events, and manages connections directly, which is 100% self-contained and compiles cleanly without peer dependency conflicts.
- **Canvas Design**:
  - The design must be a premium futuristic Dark Neon theme matching Face Bot visual requirements (primary dark bg, neon Teal/Cyan glow on hover, zero purple).
  - Left sidebar palette: draggable node types:
    - **Triggers**: Keyword Match, New Subscriber, Comment on post, Any message.
    - **Actions**: Send Message (supports ||| spin-tax, media dropdown), Add/Remove Tag, Notify Team, Wait/Delay.
    - **Conditions**: Tag Check, Platform Check, Time Check, Keyword Check.
  - Center Canvas: grid background, zoom/pan controls, handles on nodes for connecting.
  - Right Configuration Panel: pops open when clicking a node, showing fields to configure that node's configuration (text values, select dropdowns, input tags).
  - Top Control Bar: Flow name edit, Back button, Save flow button, and Activate/Deactivate toggle switch.
- **Animated Connections**:
  - Edge lines must render as animated paths (using SVG `stroke-dasharray` and a keyframes animation CSS class to represent data/flows pulsing along the paths).
- **Save & Load Integration**:
  - Integrate with the NestJS Flows APIs. Ensure you map the visual graph nodes and connection links to the relational `FlowTrigger`, `FlowStep`, and `FlowBranch` structure, saving step UUIDs.

### 3. Build & Verification
- Verify that both `frontend/` and `backend/` compile cleanly with no TypeScript compiler errors.
- Run `node run-tests-sqlite-fixed.js` in `backend/` to verify tests continue to pass.

Write a complete report of your changes, implementation design, and test outcomes to `c:\Users\pc\Desktop\face bot\.agents\worker_m2_flows\handoff.md` and send a message when done.
