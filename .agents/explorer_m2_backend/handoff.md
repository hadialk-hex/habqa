# Handoff Report - Backend Explorer M2

## 1. Observation

### A. Database Container Status
Running the `docker ps` command in the workspace directory produced the following output:
```
CONTAINER ID   IMAGE                COMMAND                  CREATED        STATUS                  PORTS                                         NAMES
0ac50e0aaa74   postgres:17-alpine   "docker-entrypoint.s…"   23 hours ago   Up 23 hours (healthy)   0.0.0.0:5433->5432/tcp, [::]:5433->5432/tcp   hubqa-postgres
c9a010b5a92b   redis:7-alpine       "docker-entrypoint.s…"   2 days ago     Up 23 hours (healthy)   0.0.0.0:6379->6379/tcp, [::]:6379->6379/tcp   hubqa_redis
```
- The PostgreSQL database is running via Docker under container name `hubqa-postgres` (port `5433`).
- Redis is running under container name `hubqa_redis` (port `6379`).

### B. TypeScript Compiler Status
Running `npx tsc --noEmit` returned exit code 1 with the following errors in tests:
```
src/challenger.spec.ts(138,44): error TS2559: Type '"true"' has no properties in common with type 'HealthQueryDto'.
src/challenger.spec.ts(142,39): error TS2559: Type '"true"' has no properties in common with type 'HealthQueryDto'.
test/challenger-emp.e2e-spec.ts(114,45): error TS2345: Argument of type 'string' is not assignable to parameter of type 'Response<any, Record<string, any>>'.
test/challenger-emp.e2e-spec.ts(121,45): error TS2345: Argument of type 'string' is not assignable to parameter of type 'Response<any, Record<string, any>>'.
test/team.e2e-spec.ts(199,33): error TS18047: 'ownerMember' is possibly 'null'.
```
The application source code inside `src/` compiles successfully, but the typing errors reside in specifications (`.spec.ts`) and end-to-end tests (`.e2e-spec.ts`).

### C. Prisma Schema (`backend/prisma/schema.prisma`)
The file defines the following relevant models:
- **`AutoReplyRule` (lines 202-230)**:
  ```prisma
  model AutoReplyRule {
    id            String              @id @default(uuid())
    tenantId      String
    connectionId  String?             // If null, applies to all connections of this tenant
    postId        String?             // If null, applies globally. If set, applies only to this specific post
    name          String
    triggerType   TriggerType
    keywords      String              // Comma separated keywords
    matchType     MatchType           @default(EXACT)
    
    replyText     String?             // Public text reply to comment
    replyMedia    Json?               // PostgreSQL JSON representing media URLs (images/videos)
    privateText   String?             // Private text DM to send
    privateMedia  Json?               // PostgreSQL JSON representing media URLs (images/videos)
    
    priority      Int                 @default(0) // Higher number = higher priority
    isActive      Boolean             @default(true)

    tenant        Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
    connection    PlatformConnection? @relation(fields: [connectionId], references: [id], onDelete: SetNull)

    createdAt     DateTime            @default(now())
    updatedAt     DateTime            @updatedAt

    @@index([tenantId])
    ...
  }
  ```
- **Flow Models (lines 366-418)**:
  Contains definitions for `Flow`, `FlowTrigger`, `FlowStep`, and `FlowBranch` with cascade deletions fully set up, e.g., `flow Flow @relation(fields: [flowId], references: [id], onDelete: Cascade)` in `FlowStep`.

### D. Existing Auto-Reply Execution
- In `backend/src/rules/rules.service.ts` (lines 83-107), manual trigger logic exists in the `trigger()` function, writing a `RULE_TRIGGERED` audit log.
- In `backend/src/webhooks/webhooks.service.ts` (lines 639-838), automatic comment replies are handled in `executeRule()`, picking random message variants and writing a `RULE_TRIGGERED` audit log.

### E. SQLite Test Converter (`backend/run-tests-sqlite-fixed.js`)
The script translates types from PostgreSQL to SQLite dynamically:
- Provider replaced: `postgresql` -> `sqlite` (line 22)
- PostgreSQL specific attributes removed: `@db.\w+` (line 25)
- JSON fields converted: `Json` -> `String` (line 28)
- String arrays converted: `String[]` -> `String` (line 31)

---

## 2. Logic Chain

1. **Rule Trigger Metrics**:
   - *Observation A & D*: Rule executions write `RULE_TRIGGERED` logs but do not maintain aggregate counts.
   - *Observation C*: `AutoReplyRule` requires additional fields to track these.
   - *Reasoning*: Adding `triggerCount Int @default(0)` and `lastTriggeredAt DateTime?` to `AutoReplyRule` in `schema.prisma` will allow direct persistence. We can perform updates using `this.prisma.autoReplyRule.update(...)` with Prisma's native `{ increment: 1 }` operator inside `RulesService.trigger` and `WebhooksService.executeRule`.

2. **Rich Message Sequencing**:
   - *Observation C*: Existing fields (`replyMedia`/`privateMedia`) are JSON arrays representing media URLs.
   - *Observation E*: The SQLite test runner converts `Json` to `String` on the fly, which means the backend must process JSON fields defensively (`typeof field === 'string' ? JSON.parse(field) : field`).
   - *Reasoning*:
     - Modifying `replyMedia`/`privateMedia` would break backward compatibility (existing string arrays).
     - Thus, we must introduce a **new column** `replyMessages Json?` on the `AutoReplyRule` model.
     - By storing an array of message nodes (with `type`, `delay`, `text`, `imageUrl`, etc.) as `replyMessages`, we can support rich sequencing (Text, Image+Caption, Carousel, Quick Replies) elegantly.

3. **Flow Endpoints**:
   - *Observation C*: Prisma schema defines `Flow`, `FlowTrigger`, `FlowStep`, and `FlowBranch` tables with cascade deletes configured on the relations.
   - *Reasoning*: 
     - The endpoints need to perform CRUD on the `Flow` parent and child entities.
     - Saving must support both creation and updates. Since visual flow steps and branches are dynamic, the cleanest update strategy is a transaction that:
       1. Updates `Flow` table.
       2. Deletes existing triggers and steps. (Deletes on steps cascade delete branches automatically).
       3. Creates new triggers and steps (along with nested branches).
     - We must preserve the step IDs generated by the UI builder (UUIDs) because branching links (`nextStepId`) depend on them.

4. **Database Migrations**:
   - *Observation A & E*: Postgres runs in a Docker container for development while SQLite is used for offline E2E test runs.
   - *Reasoning*: For PostgreSQL development database changes, the standard `npx prisma migrate dev --name <migration_name>` must be executed. This aligns with standard Prisma patterns.

---

## 3. Caveats

- **SQLite JSON Parsing**: Since tests run against SQLite and convert `Json` columns to `String`, service code reading `replyMessages` must handle parsing defensively:
  ```typescript
  const messages = typeof rule.replyMessages === 'string' 
    ? JSON.parse(rule.replyMessages) 
    : rule.replyMessages;
  ```
- **Asynchronous Delays in Sequences**: If the sequential replies structure uses large delays (e.g. 5 minutes between messages), executing them in-process inside the Webhook controller will block and time out. We assume that short delays (1-3 seconds) can be resolved using synchronous delays, while long delays will be pushed to the existing Redis/BullMQ queue system.

---

## 4. Conclusion

### Recommendation 1: Rule Trigger Metrics
1. **Schema Update**: Add columns to `AutoReplyRule` model:
   ```prisma
   triggerCount    Int       @default(0)
   lastTriggeredAt DateTime?
   ```
2. **Execution Update**: Update both `rules.service.ts` (`trigger` method) and `webhooks.service.ts` (`executeRule` method) with:
   ```typescript
   await this.prisma.autoReplyRule.update({
     where: { id: ruleId },
     data: {
       triggerCount: { increment: 1 },
       lastTriggeredAt: new Date(),
     },
   });
   ```
3. **Endpoints**: No changes are required in `rules.controller.ts` since `rulesService.getRules` returns the complete entity.

### Recommendation 2: Rich Messages Sequencing
1. **Schema Update**: Add a new column `replyMessages Json?` to `AutoReplyRule`.
2. **JSON Structure**: Structure `replyMessages` as an array of objects matching the following types:
   ```typescript
   interface ReplyMessageSequence {
     type: 'TEXT' | 'IMAGE' | 'CAROUSEL' | 'QUICK_REPLIES';
     delay?: number; // Delay in seconds
     text?: string; // Text content (supports ||| variants)
     imageUrl?: string;
     caption?: string; // Optional image caption
     cards?: Array<{
       title: string;
       subtitle?: string;
       imageUrl?: string;
       buttons?: Array<{ type: 'url' | 'postback'; title: string; url?: string; payload?: string }>;
     }>;
     quickReplies?: Array<{ title: string; payload: string }>;
   }
   ```
3. **Execution**: If `replyMessages` exists, loop through and send sequentially (using a utility delay function). If not, fall back to legacy fields.

### Recommendation 3: Flows Module CRUD
Create a new module `FlowsModule` with endpoints:
- `GET /flows`: List flows.
- `GET /flows/:id`: Get flow details.
- `POST /flows` / `PUT /flows/:id`: Save flow (creates/updates using transaction).
- `PATCH /flows/:id/active`: Toggle activation status.
- `DELETE /flows/:id`: Delete flow.

**Prisma Transaction Implementation for Saving Flows**:
```typescript
async saveFlow(id: string | undefined, tenantId: string, dto: SaveFlowDto) {
  return this.prisma.$transaction(async (tx) => {
    let flowId = id;
    if (!flowId) {
      const flow = await tx.flow.create({
        data: { tenantId, name: dto.name, description: dto.description, isActive: dto.isActive ?? false },
      });
      flowId = flow.id;
    } else {
      await tx.flow.update({
        where: { id: flowId },
        data: { name: dto.name, description: dto.description, isActive: dto.isActive ?? false },
      });
      await tx.flowTrigger.deleteMany({ where: { flowId } });
      await tx.flowStep.deleteMany({ where: { flowId } });
    }

    if (dto.triggers) {
      await tx.flowTrigger.createMany({
        data: dto.triggers.map((t) => ({ flowId, type: t.type, configuration: t.configuration || Prisma.JsonNull })),
      });
    }

    if (dto.steps) {
      for (const step of dto.steps) {
        await tx.flowStep.create({
          data: {
            id: step.id, // Preserves UUID generated by front-end editor
            flowId,
            type: step.type,
            configuration: step.configuration,
            metadata: step.metadata || Prisma.JsonNull,
            branches: {
              create: step.branches?.map((b) => ({
                label: b.label,
                condition: b.condition || Prisma.JsonNull,
                nextStepId: b.nextStepId,
              })) || [],
            },
          },
        });
      }
    }
    return tx.flow.findUnique({
      where: { id: flowId },
      include: { triggers: true, steps: { include: { branches: true } } },
    });
  });
}
```

### Recommendation 4: Database Migration Command
To apply these changes:
1. Edit `backend/prisma/schema.prisma`.
2. Run `npx prisma migrate dev --name add_metrics_and_rich_sequencing` inside the `backend` directory.
3. Verify that the client is generated successfully.
4. Run `node run-tests-sqlite-fixed.js` to ensure the E2E test suite remains green.

---

## 5. Verification Method

To verify these changes:
1. **Schema Check**: Run `npx prisma validate` inside the `backend` directory to ensure schema validity.
2. **Compilation**: Run `npm run build` or `npx tsc --noEmit` inside the `backend` directory to ensure typing remains correct.
3. **Database Test**: Trigger the database container locally, execute a rule, and verify in the database that `triggerCount` increments and `lastTriggeredAt` is set.
4. **E2E Tests**: Run the offline test runner to ensure SQLite translation passes successfully:
   ```bash
   node run-tests-sqlite-fixed.js
   ```
