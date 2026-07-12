# Handoff Report: Visual Flow Builder Architecture Plan (Milestone 2)

## 1. Observation
We observed the following regarding the project configuration, backend models, and frontend setup:
* **Frontend Setup**: In `c:\Users\pc\Desktop\face bot\frontend\package.json`, the dashboard frontend is built on Next.js 16.2.10, React 19.2.4, Tailwind CSS v4, Lucide React, and Framer Motion:
  ```json
  "dependencies": {
    "next": "16.2.10",
    "react": "19.2.4",
    "tailwind-merge": "^3.6.0",
    "framer-motion": "^12.42.2",
    "lucide-react": "^1.23.0"
  }
  ```
* **Database Models for Flow Engine**: In `c:\Users\pc\Desktop\face bot\backend\prisma\schema.prisma` (lines 363-456), the database schema already includes the standard models for storing flows:
  * `Flow` (id, tenantId, name, description, isActive)
  * `FlowTrigger` (id, flowId, type, configuration)
  * `FlowStep` (id, flowId, type, configuration, metadata) -> Contains `metadata` JSON for editor positions.
  * `FlowBranch` (id, stepId, label, condition, nextStepId)
  * `FlowExecution` (id, flowId, tenantId, customerId, status, currentStepId, variables, pausedUntil)
  * `FlowExecutionLog` (id, executionId, stepId, stepType, executedAt, status, error)
* **API Structure**: Checked `c:\Users\pc\Desktop\face bot\backend\src\app.module.ts` and confirmed `FlowsModule` is not yet registered. However, existing modules like `Rules` show that backend endpoints use `@UseGuards(JwtAuthGuard)` to validate session tokens, and use NestJS controllers returning data directly from Prisma Service.

---

## 2. Logic Chain
To create a visual node-based flow builder at `c:\Users\pc\Desktop\face bot\frontend\src\app\dashboard\flows\`, the frontend must support:
1. **Canvas Rendering & Layout**: 
   * Since React 19 is used, older versions of flow-builder libraries suffer from dependency conflicts. The `@xyflow/react` v12 library is the direct successor of React Flow and provides native support for React 19.
   * To provide a rich interface, the layout should consist of a sidebar palette for dragging nodes, a zooming/panning canvas containing custom node components styled with Tailwind v4, and a configuration drawer/panel that pops open on node selection.
2. **Support for Node Types**:
   * *Triggers*: (Keyword Match, New Subscriber, Comment, Any Message). These represent starting points (only output handles).
   * *Actions*: (Send Message, Add Tag, Remove Tag, Notify Team, Wait/Delay). These represent execution units (input and output handles).
   * *Conditions*: (Tag, Platform, Time, Keyword). These represent routing decisions (input and multiple output handles).
   * These node properties directly map to the `FlowTrigger`, `FlowStep`, and `FlowBranch` schemas in the database.
3. **Animated Connection Lines**:
   * SVG path animations using Tailwind v4 or raw CSS keyframes combined with `@xyflow/react` custom edge components can be used to animate paths.
   * This is achieved by animating `stroke-dasharray` and `stroke-dashoffset` in CSS to draw moving dots along the connections.
4. **Saving and Activation**:
   * A bidirectional mapping translates the React Flow graph structure (Nodes/Edges list) to the Prisma relational schema (Triggers, Steps, and Branches).
   * Active status toggling is handled through dedicated API calls updating `Flow.isActive` to start/stop the NestJS background processing engines.

---

## 3. Caveats
* The NestJS backend `FlowsModule` controllers and service implementations are not yet present in `backend/src/`. This report scopes the API endpoints and JSON payloads that the implementer must create to ensure compatibility with this frontend design.
* Node positioning in React Flow uses a relative 2D coordinate system. Saving this data requires serializing coordinates directly to the `FlowStep.metadata` and `FlowTrigger.configuration` fields in Prisma.

---

## 4. Conclusion
We recommend implementing the visual flow builder using `@xyflow/react` (v12) inside the new dashboard directory `frontend/src/app/dashboard/flows`. The implementation plan is structured as follows:

### A. Flow Builder UI Canvas & Layout
1. **Canvas Component Setup**:
   * Create `frontend/src/app/dashboard/flows/components/flow-canvas.tsx` wrapped in `<ReactFlowProvider>`.
   * Add controls: `<Background variant="dots" gap={16} size={1} />`, `<MiniMap />`, and `<Controls />`.
   * Implement custom nodes map for `@xyflow/react`:
     ```typescript
     const nodeTypes = {
       triggerNode: TriggerNodeComponent,
       actionNode: ActionNodeComponent,
       conditionNode: ConditionNodeComponent,
     };
     ```
2. **Layout Structure**:
   * **Left-side Palette**: Vertical list of node templates with HTML5 `draggable` properties. Users drag nodes onto the canvas. Use `screenToFlowPosition` in `@xyflow/react` to drop nodes at the correct canvas coordinates.
   * **Right-side Panel (Settings Drawer)**: A responsive sliding drawer (`@/components/ui/sheet` or Dialog) that displays fields to configure the selected node's `configuration` (e.g. textarea for message content, inputs for tags).
   * **Header Bar**: Displays flow name, back button, "Save" button, and a switch to toggle flow state (`isActive`).

### B. Node Types Implementation
Each node should render using a custom React component using Tailwind CSS styling and Shadcn UI components. Output handles should be named according to their branches.

1. **Triggers** (0 Input Handles, 1 Output Handle):
   * **Keyword match**: Configuration input for a list of words, select dropdown for MatchType (`EXACT`, `CONTAINS`, `STARTS_WITH`, `ENDS_WITH`).
   * **New subscriber**: Standard node informing user it fires when a new subscriber joins the CRM.
   * **Comment**: Select page, toggle to input specific FB post ID (integrates existing `PostPicker` component), optional text keyword filter.
   * **Any message**: Simple node indicating it triggers on any incoming private chat.

2. **Actions** (1 Input Handle, 1 Output Handle):
   * **Send message**: Form field for template text (with Arabic translation, support for spin-tax `|||` to randomize responses to prevent Facebook spam bans). Dropdown for attachment media (Image/Video).
   * **Add tag / Remove tag**: Multi-select tag input.
   * **Notify team**: Multi-select dropdown for team member IDs, select notify channel (Email, Dashboard notification).
   * **Wait/Delay**: Select field for unit (`MINUTES`, `HOURS`, `DAYS`), and numeric input for amount.

3. **Conditions** (1 Input Handle, Multiple Output Handles):
   * **Tag condition**: Output handles for `Yes` (has tag) and `No` (does not have tag).
   * **Platform condition**: Output handles for `Messenger`, `Instagram`, `WhatsApp`, and `Default`.
   * **Time condition**: Configuration of active days (Mon-Sun) and daily start/end times. Output handles for `Within Hours` and `Outside Hours`.
   * **Keyword condition**: Matches user-defined keywords, containing multiple output handles for each branch, and a default branch.

### C. Animated Visual Connection Lines
To draw beautiful animated connection lines:
1. Create a custom edge component: `frontend/src/app/dashboard/flows/components/animated-edge.tsx`.
2. Define a Tailwind keyframe or global CSS class to animate the SVG stroke:
   ```css
   @keyframes flow-animation {
     to {
       stroke-dashoffset: -20;
     }
   }
   .animated-flow-line {
     stroke-dasharray: 6, 4;
     animation: flow-animation 1.2s linear infinite;
     stroke: var(--primary); /* Face Bot Primary Brand Color */
     stroke-width: 3.5px;
     filter: drop-shadow(0 0 2px var(--primary-foreground));
   }
   ```
3. Pass `animated: true` or apply this CSS class to edges when the flow is active or when performing test execution.

### D. Saving, Activating, and Deactivating via APIs
We must introduce NestJS controllers in `backend/src/` to handle client operations.

1. **API Endpoints**:
   * `GET /api/backend/flows`: List of saved flows.
   * `GET /api/backend/flows/:id`: Details of a specific flow (nested triggers, steps, and branches).
   * `POST /api/backend/flows`: Create a blank flow.
   * `PUT /api/backend/flows/:id`: Save flow canvas data.
   * `PUT /api/backend/flows/:id/toggle-active`: Toggle active state (`isActive`).
   * `DELETE /api/backend/flows/:id`: Delete a flow.

2. **Graph-to-Relational Serialization**:
   * When saving, the frontend transforms `@xyflow/react` nodes and edges into relational entities:
     * **Triggers**: Nodes of type `triggerNode` are saved to the `FlowTrigger` table.
     * **Steps**: Nodes of type `actionNode` or `conditionNode` are saved to the `FlowStep` table. Canvas coordinate `{ x, y }` is stored in the `metadata` JSON field.
     * **Branches**:
       * For action nodes: Map the single output edge to a single `FlowBranch` record with label `next` pointing to the target step's database ID.
       * For condition nodes: Map each output handle edge to a `FlowBranch` record. The `handleId` (e.g. `yes` or `no`) becomes the `FlowBranch.label`, pointing to the corresponding target step.
       * If a handle is disconnected, no branch record is created, or `nextStepId` is set to `null` to mark an endpoint.
   * Example request body for `PUT /api/backend/flows/:id`:
     ```json
     {
       "name": "الرد الآلي على استفسار السعر",
       "description": "يرسل السعر ويصنف العميل إذا أرسل كلمة السعر",
       "triggers": [
         {
           "type": "INCOMING_MESSAGE",
           "configuration": { "keywords": ["سعر", "السعر", "بكم"], "matchType": "CONTAINS" }
         }
       ],
       "steps": [
         {
           "id": "temp-action-1",
           "type": "SEND_MESSAGE",
           "configuration": { "replyText": "السعر هو 100 دولار" },
           "metadata": { "position": { "x": 100, "y": 200 } },
           "branches": [
             { "label": "next", "nextStepId": "temp-action-2" }
           ]
         },
         {
           "id": "temp-action-2",
           "type": "ADD_TAG",
           "configuration": { "tags": ["مهتم"] },
           "metadata": { "position": { "x": 100, "y": 400 } },
           "branches": []
         }
       ]
     }
     ```

---

## 5. Verification Method
1. **Frontend Compilability**: Once implemented, verify Next.js hot reload and dev build via `npm run build` in the `frontend` folder to ensure no React 19 peer dependency conflicts arise.
2. **Check Package Compatibilities**: Ensure `@xyflow/react` version 12 is specified in `frontend/package.json`.
3. **Database Checks**: Run `npx prisma db push` or migrations to verify that Prisma schema synchronizes correctly on local PostgreSQL before initiating integrations.
