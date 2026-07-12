# Database Migration Analysis & Plan (SQLite to PostgreSQL)

This document outlines the design and plan for migrating the database schema of the backend from SQLite to PostgreSQL. 

---

## 1. Executive Summary
The existing SQLite database schema relies on string fields to represent both categorical data (enums) and JSON data. SQLite does not natively support these data structures, leading to less strict validation and potential performance issues. By migrating to PostgreSQL, we can leverage native features including:
- **Native Enums** for type-safe categorization.
- **Native Json/Jsonb Types** for efficient storage, indexing, and querying of structured document-like data.
- **Explicit Indexing (`@@index`)** on foreign keys and frequently filtered columns to maintain high query performance as data scales.

---

## 2. PostgreSQL Configuration Changes
In `backend/prisma/schema.prisma`, the datasource block is updated to specify the `postgresql` provider. The database URL continues to be pulled from the environment:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## 3. Schema Transformation Details

### 3.1. String to Native Enum Mappings
The following fields are converted from `String` to Postgres-native `enum` types:

| Model | Field | Original Type | Target Enum Type & Allowed Values | Default Value | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tenant** | `plan` | `String` | `TenantPlan` { `STARTER`, `PRO`, `ENTERPRISE` } | `STARTER` | Used for multi-tenant billing & feature flags. |
| **TenantMember** | `role` | `String` | `TenantRole` { `OWNER`, `ADMIN`, `MEMBER` } | `MEMBER` | Tenant access levels. |
| **PlatformConnection** | `platform` | `String` | `PlatformType` { `FACEBOOK_PAGE`, `INSTAGRAM`, `WHATSAPP` } | *None* | External platform integration types. |
| **AutoReplyRule** | `triggerType` | `String` | `TriggerType` { `KEYWORD`, `ANY_COMMENT`, `STORY_MENTION` } | *None* | Automation trigger classification. |
| **AutoReplyRule** | `matchType` | `String` | `MatchType` { `EXACT`, `CONTAINS`, `AI_SEMANTIC` } | `EXACT` | Rule matching strategies. |
| **Conversation** | `status` | `String` | `ConversationStatus` { `OPEN`, `RESOLVED` } | `OPEN` | Inbox ticket state. |
| **Message** | `direction` | `String` | `MessageDirection` { `INBOUND`, `OUTBOUND` } | *None* | Message flow direction. |
| **Message** | `messageType` | `String` | `MessageType` { `TEXT`, `IMAGE`, `COMMENT` } | `TEXT` | Message payload type. |

### 3.2. String to Native JSON Mappings
The following fields, previously serialized as JSON strings in SQLite, are updated to native PostgreSQL `Json` types:

| Model | Field | Original Type | Target Type | Purpose / Description |
| :--- | :--- | :--- | :--- | :--- |
| **AutoReplyRule** | `replyMedia` | `String?` | `Json?` | List of media URLs (images/videos) for public replies. |
| **AutoReplyRule** | `privateMedia`| `String?` | `Json?` | List of media URLs (images/videos) for private DMs. |
| **Message** | `metaData` | `String?` | `Json?` | Original webhook payloads or metadata for integration tracking. |

---

## 4. Indexing Strategy (`@@index`)

Under PostgreSQL, explicit indexes are crucial for performance. Databases automatically index primary keys (`@id`) and unique fields (`@unique`), but they do not automatically index foreign keys (`relation(fields: [...])`) or fields that are frequently used in `where` filters and `orderBy` sorting.

We have identified and added the following explicit indexes across the tables:

### 4.1. TenantMember
- **`@@index([tenantId])`**: Filters memberships by tenant. (Note: `userId` is already indexed as the leading column in the compound `@@unique([userId, tenantId])` constraint).

### 4.2. PlatformConnection
- **`@@index([tenantId])`**: Speeds up fetching all social media connections for a given tenant.
- **`@@index([platformId])`**: While there is a `@@unique([platform, platformId])` constraint, PostgreSQL cannot efficiently use that index when querying *only* by `platformId` (since it is the second column). An explicit index on `platformId` makes single Platform ID lookups extremely fast.
- **`@@index([isActive])`**: Fast filtering of active connections when executing background webhook routing.

### 4.3. AutoReplyRule
- **`@@index([tenantId])`**: Fast retrieval of all automation rules belonging to a tenant.
- **`@@index([connectionId])`**: Fast lookup of connection-specific rules.
- **`@@index([triggerType])`**: Allows quick filtering of rules matching a specific trigger type (e.g. only fetching `KEYWORD` rules when a comment comes in).
- **`@@index([isActive])`**: Quickly filters out inactive rules from rule matching evaluation.

### 4.4. Conversation
- **`@@index([tenantId])`**: Speeds up loading the unified inbox conversations list for a tenant.
- **`@@index([status])`**: Speeds up filtering conversations by status (e.g., loading only `OPEN` conversations in the UI).
- **`@@index([lastMessageAt])`**: Important for sorting the inbox (ordering conversations from newest to oldest).

### 4.5. Message
- **`@@index([conversationId])`**: Crucial for retrieving all messages within a given conversation thread.
- **`@@index([createdAt])`**: Used for ordering messages sequentially inside the conversation view.

---

## 5. Verification & Implementation Roadmap
1. **Schema Validation**: Run `npx prisma validate` with the new schema configuration to ensure relations and syntax are correct.
2. **Environment Variable Configuration**: Ensure the target database environment has `DATABASE_URL` set to a valid PostgreSQL connection string (e.g. `postgresql://user:password@localhost:5432/dbname?schema=public`).
3. **Migration Generation**: Run `npx prisma migrate dev --name init_postgres` to generate SQL DDL commands and apply them.
4. **Data Porting (if applicable)**: Write custom scripts or use ETL tools to migrate existing SQLite data, converting JSON strings to native JSON objects, and ensuring casing matches the new Enum names exactly.
