## 2026-07-09T12:35:06Z
<USER_REQUEST>
You are Explorer 2 (teamwork_preview_explorer) for the database migration milestone.
Your working directory is c:\Users\pc\Desktop\face bot\.agents\explorer_m2_2\.
Your task is to:
1. Analyze the existing backend/prisma/schema.prisma file (which is currently using SQLite).
2. Design a migration plan to convert the schema to PostgreSQL:
   - Change provider = "postgresql" and use env-based database URL.
   - Map existing String fields to native PostgreSQL enums where appropriate (e.g., plan in Tenant, role in TenantMember, platform in PlatformConnection, triggerType & matchType in AutoReplyRule, status in Conversation, direction & messageType in Message).
   - Map JSON fields (replyMedia, privateMedia in AutoReplyRule, and metaData in Message) from String to native PostgreSQL Json type.
3. Identify frequently queried columns that need proper database-level indexes (@@index), such as tenantId, platformId, triggerType, isActive, etc., across all tables.
Document your design and findings in c:\Users\pc\Desktop\face bot\.agents\explorer_m2_2\analysis.md and report back when finished.
</USER_REQUEST>
