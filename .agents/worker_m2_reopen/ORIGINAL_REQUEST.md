## 2026-07-11T10:24:26Z
You are the Worker subagent (teamwork_preview_worker) for the database migration milestone.
Your working directory is c:\Users\pc\Desktop\face bot\.agents\worker_m2_reopen\.

### Context
The parent has reopened the Database Migration milestone because the Victory Auditor rejected the project completion. Specifically, `backend/prisma/schema.prisma` is still configured with `provider = "sqlite"` at line 9. A subsequent agent likely reverted the PostgreSQL schema changes to make their own SQLite-based tests pass. We must permanently transition the database provider to `postgresql` and restore the PostgreSQL-native schema structure.

### Tasks
1. Read the current database schema in `backend/prisma/schema.prisma`.
2. Transition the database provider block to "postgresql":
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Update fields in `schema.prisma` to use native PostgreSQL enums:
   - Define enums `TenantPlan`, `TenantRole`, `PlatformType`, `TriggerType`, `MatchType`, `ConversationStatus`, `MessageDirection`, `MessageType`, and `CampaignStatus` in the schema file.
   - Update model fields to use these enums (e.g., `Tenant.plan` to `TenantPlan`, `TenantMember.role` to `TenantRole`, `PlatformConnection.platform` to `PlatformType`, etc.).
4. Update fields in `schema.prisma` to use native `Json` and `String[]` types:
   - Change fields containing JSON string blobs (`replyMedia`, `privateMedia` in `AutoReplyRule`, `metaData` in `Message`, `oldValues`, `newValues` in `AuditLog`, `mediaUrl` in `Campaign`, `configuration` in `FlowTrigger`, `configuration` and `metadata` in `FlowStep`, `condition` in `FlowBranch`, `variables` in `FlowExecution`) to native `Json` / `Json?` types.
   - Change `CustomRole.permissions` and `Subscriber.tags` to `String[]` (native PostgreSQL text array).
5. Ensure all database indexes (@@index) on foreign keys and queried fields are preserved.
6. Verify and compile:
   - Run `npx prisma validate` inside the `backend` folder to ensure the schema is syntactically correct.
   - Run `npx prisma generate` inside the `backend` folder to regenerate the Prisma Client.
   - Run `npm run build` inside the `backend` folder. If any TypeScript compilation errors occur in NestJS services or controllers due to the new Enum/Json typings, resolve them (e.g., import the enum from `@prisma/client`, or cast strings, or adjust types).
   - Verify NestJS tests by running `npm run test` inside the `backend` folder.
7. Update `backend/.env` to ensure `DATABASE_URL` uses the PostgreSQL connection string format (e.g. pointing to the local postgres container).
8. Write a detailed handoff report in c:\Users\pc\Desktop\face bot\.agents\worker_m2_reopen\handoff.md showing validation outputs, compile outputs, and confirming the schema changes.

MANDATORY INTEGRITY WARNING:
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
