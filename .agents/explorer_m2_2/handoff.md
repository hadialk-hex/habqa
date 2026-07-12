# Handoff Report

## 1. Observation
- The original SQLite schema file is located at `backend/prisma/schema.prisma`.
- We observed specific fields that were currently stored as strings but represented categorical data:
  - `plan` in `Tenant`: `"STARTER"`, `"PRO"`, `"ENTERPRISE"` (line 31)
  - `role` in `TenantMember`: `"OWNER"`, `"ADMIN"`, `"MEMBER"` (line 45)
  - `platform` in `PlatformConnection`: `"FACEBOOK_PAGE"`, `"INSTAGRAM"`, `"WHATSAPP"` (line 65)
  - `triggerType` in `AutoReplyRule`: `"KEYWORD"`, `"ANY_COMMENT"`, `"STORY_MENTION"` (line 91)
  - `matchType` in `AutoReplyRule`: `"EXACT"`, `"CONTAINS"`, `"AI_SEMANTIC"` (line 93)
  - `status` in `Conversation`: `"OPEN"`, `"RESOLVED"` (line 121)
  - `direction` in `Message`: `"INBOUND"`, `"OUTBOUND"` (line 136)
  - `messageType` in `Message`: `"TEXT"`, `"IMAGE"`, `"COMMENT"` (line 138)
- We observed specific fields storing JSON strings:
  - `replyMedia` in `AutoReplyRule` (line 96)
  - `privateMedia` in `AutoReplyRule` (line 98)
  - `metaData` in `Message` (line 139)
- We observed that foreign keys and frequently queried fields (e.g., `tenantId`, `connectionId`, `isActive`, `status`, `lastMessageAt`, `createdAt`) did not have explicit index (`@@index`) declarations in the SQLite schema.

## 2. Logic Chain
- **Step 1 (Database Provider Change)**: To convert the schema to PostgreSQL, we must update `provider = "sqlite"` to `provider = "postgresql"`. Since `url = env("DATABASE_URL")` is already configured, we keep it to support env-based database connection strings.
- **Step 2 (Categorical Validation)**: PostgreSQL natively supports type-safe `enum` structures, unlike SQLite. Thus, creating enums for the specified fields (`TenantPlan`, `TenantRole`, `PlatformType`, `TriggerType`, `MatchType`, `ConversationStatus`, `MessageDirection`, `MessageType`) and updating the field types prevents invalid values from entering the database and reduces storage overhead.
- **Step 3 (JSON Support)**: PostgreSQL has native `Json`/`Jsonb` types which are highly optimized for document structure storage and nested querying. Thus, changing the type of `replyMedia`, `privateMedia`, and `metaData` from `String?` to `Json?` ensures better database-level document integrity and query capability.
- **Step 4 (Query Optimization)**: 
  - Without explicit database-level indexes on foreign keys (`tenantId`, `connectionId`, `conversationId`) and high-cardinality queried fields (`status`, `lastMessageAt`, `createdAt`), database scans will become full table scans as the tables scale, severely degrading performance.
  - Adding indexes (e.g., `@@index([tenantId])`, `@@index([connectionId])`, `@@index([isActive])`, etc.) ensures lookups, filters, and ordering operations use index scans.
  - Adding `@@index([platformId])` on `PlatformConnection` is necessary because `platformId` is the second column in the unique compound index `@@unique([platform, platformId])`. Queries filtering by `platformId` alone cannot leverage the compound unique index in PostgreSQL.

## 3. Caveats
- Since this is a read-only investigation, the database schema migration has not been applied to a running PostgreSQL database instance.
- We assume that the existing codebase and API handlers serialize and deserialize JSON objects directly (not stringified JSON). If they expect stringified JSON, the Prisma Client code will need to be updated to match the new `Json` types returned by the client.
- Casing of existing database records must match the Enum definitions exactly (e.g., lowercase values or other casing conventions in SQLite would violate the PostgreSQL Enum constraint during data migration).

## 4. Conclusion
The proposed schema in `proposed_schema.prisma` successfully maps all requested fields to native PostgreSQL enums and JSON types, switches the datasource provider, and adds crucial database indexes on frequently queried fields. The changes are fully captured in the `schema.patch` diff file.

## 5. Verification Method
- **Prisma Syntax Validation**:
  Copy the proposed schema or apply the patch to `backend/prisma/schema.prisma`, then run:
  ```bash
  npx prisma validate --schema=backend/prisma/schema.prisma
  ```
  This command will parse the schema and verify the validity of all relation models, field types, enums, and indexes.
- **Migration Dry-Run**:
  To verify if the SQL is generated correctly for PostgreSQL, configure a local PostgreSQL instance, update `DATABASE_URL` in the environment, and run:
  ```bash
  npx prisma migrate dev --create-only --name init_postgres
  ```
  Inspect the generated SQL files in `backend/prisma/migrations/` to confirm that all Enums, JSON columns, and indexes are properly declared.
