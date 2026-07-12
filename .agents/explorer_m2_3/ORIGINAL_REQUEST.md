## 2026-07-09T12:35:08Z

You are Explorer 3 (teamwork_preview_explorer) for the database migration milestone.
Your working directory is c:\Users\pc\Desktop\face bot\.agents\explorer_m2_3\.
Your task is to:
1. Design schema extensions to support the following missing features in the PostgreSQL schema:
   - Broadcasts / Campaign management (models, relations, enums).
   - Audit logging (models, tracking who did what, changes, etc.).
   - Webhook deduplication (table/model to track webhook transaction/request IDs to prevent duplicate processing).
   - Password reset tokens (model linked to User with expiration).
   - Team roles (verify if TenantMember role enum is sufficient or if extra role/permission models are needed).
   - Flow automation (models representing automation flows, triggers, steps/actions, etc.).
2. Design the enhancement of the seeding logic (backend/seed.js or a new seed script) to populate initial data compatible with the new PostgreSQL schema.
Document your designs and findings in c:\Users\pc\Desktop\face bot\.agents\explorer_m2_3\analysis.md and report back when finished.
