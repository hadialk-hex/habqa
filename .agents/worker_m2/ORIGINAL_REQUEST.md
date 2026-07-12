## 2026-07-09T12:39:21Z

<USER_REQUEST>
You are the Worker subagent (teamwork_preview_worker) for the database migration milestone.
Your working directory is c:\Users\pc\Desktop\face bot\.agents\worker_m2\.

### Tasks
1. Read the analysis reports and proposed files from the three Explorers:
   - Explorer 1 (local PG setup): `.agents/explorer_m2_1/analysis.md`, `proposed_docker-compose.yml`, `proposed_start-db.ps1`
   - Explorer 2 (schema migration & indexes): `.agents/explorer_m2_2/analysis.md`, `proposed_schema.prisma`
   - Explorer 3 (schema extensions & seeding): `.agents/explorer_m2_3/analysis.md`, `proposed_schema.prisma`, `proposed_seed.js`

2. Implement the local PostgreSQL environment setup:
   - Create `docker-compose.yml` in the `backend` folder.
   - Create `start-db.ps1` in the `backend` folder.
   - Start the database container and verify it is running and healthy.

3. Update `backend/.env`:
   - Change `DATABASE_URL` to point to the PostgreSQL container: `postgresql://postgres:postgrespassword@localhost:5432/hubqa?schema=public`

4. Implement `backend/prisma/schema.prisma`:
   - Provider changed to "postgresql".
   - Map existing String fields to enums (TenantPlan, TenantRole, PlatformType, TriggerType, MatchType, ConversationStatus, MessageDirection, MessageType). Ensure Tenant.plan is typed as TenantPlan (default STARTER) and TenantMember.role is typed as TenantRole (default MEMBER).
   - Map JSON fields (replyMedia, privateMedia in AutoReplyRule, and metaData in Message) to native Json? type.
   - Combine all index annotations (@@index) from Explorer 2's proposed schema and add appropriate index annotations for all new tables from Explorer 3.
   - Include all new feature models from Explorer 3 (WebhookDeduplication, Campaign, CampaignRecipient, AuditLog, Flow, FlowTrigger, FlowStep, FlowBranch, FlowExecution, FlowExecutionLog, PasswordResetToken, CustomRole).

5. Update `backend/seed.js` with the enhanced seeding logic (based on Explorer 3's proposed_seed.js), ensuring it populates realistic test data for all new and existing models without foreign key issues.

6. Verify the changes:
   - Validate the schema using `npx prisma validate` in `backend`.
   - Generate the Prisma Client using `npx prisma generate` in `backend`.
   - Start the database container and apply the schema using `npx prisma db push` or `npx prisma migrate dev --name init_postgres`.
   - Run the seeding script `node seed.js` in `backend`.
   - Verify that the NestJS backend compiles and runs tests by executing `npm run build` and `npm run test` in the `backend/` directory.

7. Write a detailed handoff report in c:\Users\pc\Desktop\face bot\.agents\worker_m2\handoff.md detailing the actions taken, the command results, and verifying the new database layout.

MANDATORY INTEGRITY WARNING:
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
</USER_REQUEST>
