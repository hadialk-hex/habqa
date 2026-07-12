# Database Migration Schema Design & Seeding Analysis

This analysis outlines the database schema design extensions and seeding logic enhancements for migrating the **Neqta** application from SQLite to **PostgreSQL**. 

---

## 1. Executive Summary
- **Database Engine Migration**: SQLite to PostgreSQL enables native enum types, JSON/JSONB objects, text arrays, and more robust indexing.
- **New Feature Models**: Designed models and relationships for campaigns/broadcasts, audit logging, webhook deduplication, password reset tokens, dynamic RBAC, and visual flow automation.
- **Seeding Enhancements**: Designed an end-to-end seed script to generate realistic initial data, ensuring all foreign keys, enums, and JSON payloads conform to the new PostgreSQL schemas.
- **Reference Files**:
  - Proposed Prisma Schema: `.agents/explorer_m2_3/proposed_schema.prisma`
  - Proposed Seeding Script: `.agents/explorer_m2_3/proposed_seed.js`

---

## 2. Schema Extensions & Design Rationale

### A. Broadcasts & Campaign Management
*Goal: Support mass messaging campaigns targeting customers via different platforms (Facebook Page, Instagram, WhatsApp) with scheduling and receipt tracking.*

#### Design
- **Campaign (or Broadcast)**:
  - Stores metadata of a broadcast, including target platform connection, execution message/template (`content`), media attachments (`mediaUrl` as native PostgreSQL `Json`), scheduled start time (`scheduledAt`), and status.
  - Uses `CampaignStatus` enum: `DRAFT`, `SCHEDULED`, `SENDING`, `COMPLETED`, `FAILED`, `CANCELLED`.
- **CampaignRecipient**:
  - Tracks individual delivery status (`PENDING`, `SENT`, `DELIVERED`, `READ`, `FAILED`) and errors per recipient (customer).
  - Linked via `campaignId` with a composite unique constraint `@@unique([campaignId, customerId])` to prevent double-messaging.

#### Rationale
Splitting campaigns and recipients allows granular tracking of campaign progress and success rates. Storing media structures as `Json` allows flexible message layouts (e.g. text + button, image, video templates) without changing the database schema.

---

### B. Audit Logging
*Goal: Track admin actions and system operations for security audits, showing "who, what, when, and what changed."*

#### Design
- **AuditLog Model**:
  - `tenantId` (String): Scopes audits to a tenant.
  - `userId` (String, Nullable): Tracks which team member made the change (null for system/webhook actions).
  - `action` (String): Verbose action name (e.g., `CAMPAIGN_CREATED`, `RULE_UPDATED`).
  - `entityType` & `entityId` (String): Specifies what record was modified (e.g., `PlatformConnection`, ID).
  - `oldValues` & `newValues` (Json): Captures snapshot diffs.
  - `ipAddress` & `userAgent` (String): Tracks request source.
- **Indexing**:
  - `@@index([tenantId, createdAt])` for fast filtering in tenant dashboard audit views.

#### Rationale
Using PostgreSQL's native `Json` fields for `oldValues`/`newValues` avoids stringifying/parsing JSON in the backend code, increasing performance and enabling JSON-based search queries if required.

---

### C. Webhook Deduplication
*Goal: Prevent duplicate message processing or double automated actions due to webhook delivery retries from Facebook, WhatsApp, or Instagram.*

#### Design
- **WebhookDeduplication Model**:
  - `eventId` (String, Unique): Platform-provided transaction or message identifier.
  - `platform` (String): `FACEBOOK`, `WHATSAPP`, `INSTAGRAM`.
  - `status` (String): `PROCESSING`, `PROCESSED`, `FAILED` (supports lock mechanisms if execution is slow).
  - `expiresAt` (DateTime): Timestamp indicating when the record can be safely deleted.
- **Indexes**:
  - `@@index([expiresAt])` to allow a daily database prune job (`DELETE FROM WebhookDeduplication WHERE expiresAt < NOW()`).

#### Rationale
Webhooks usually retry within 24 to 48 hours. Saving and indexing `expiresAt` ensures the table does not grow infinitely, while keeping lookups extremely fast (leveraging the unique constraint on `eventId`).

---

### D. Password Reset Tokens
*Goal: Allow users to securely request password resets with temporary, single-use tokens.*

#### Design
- **PasswordResetToken Model**:
  - `userId` (String): Relates to `User`.
  - `token` (String, Unique): Hashed representation of the reset token (to prevent database exposure leading to account compromise).
  - `expiresAt` (DateTime): Time limit.
  - `usedAt` (DateTime, Nullable): Tracks when token was consumed.
  - `createdAt` (DateTime): Tracks creation.

#### Rationale
Enforcing a unique index on `token` allows fast lookup. Cascading delete on `User` ensures tokens are automatically removed if a user account is deleted.

---

### E. Team Roles & Granular RBAC
*Goal: Verify if the current `role` enum in `TenantMember` is sufficient, and propose enhancements for custom team roles/permissions.*

#### Evaluation
1. **Is `TenantMember.role` (OWNER, ADMIN, MEMBER) sufficient?**
   - For early-stage multi-tenant applications, yes.
   - For enterprise-ready applications, **no**. It lacks granular access controls (e.g. separating support agents who read/write DMs from marketing specialists who manage campaigns and billing).
2. **Proposed Enhancement: Hybrid RBAC**
   - **Static Enums**: Retain native PostgreSQL `TenantRole` (`OWNER`, `ADMIN`, `MEMBER`, `AGENT`, `VIEWER`) for standard out-of-the-box roles.
   - **Dynamic Custom Roles**: Introduce a `CustomRole` model.
     - `tenantId` (String): Relates to Tenant.
     - `name` (String): Unique role name within the tenant (e.g., "Night Shift Agent").
     - `permissions` (String[]): Uses PostgreSQL's native text array to store specific permissions (e.g., `["inbox:read", "inbox:write"]`).
   - **TenantMember Update**: Add a nullable `roleId` referencing `CustomRole`. If `roleId` is present, it overrides or extends the static `role` enum.

#### Schema Snippet
```prisma
enum TenantRole {
  OWNER
  ADMIN
  MEMBER
  AGENT
  VIEWER
}

model CustomRole {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  permissions String[] // Native PostgreSQL text array
  // ... relations
}
```

---

### F. Flow Automation Engine
*Goal: Upgrade the simple `AutoReplyRule` (keyword matches reply text) into a multi-step visual canvas automation flow engine (e.g. welcome sequence, conditional branching, delays).*

#### Design
- **Flow**: Represents the entire workflow container.
- **FlowTrigger**: The starting node (e.g., matching keywords, comment received, contact tag added).
- **FlowStep**: Node actions (e.g. `SEND_MESSAGE`, `WAIT_DELAY`, `ADD_TAG`). Stores UI coordinates in `metadata`.
- **FlowBranch**: For split nodes (e.g. if customer chooses option 1, go to step A; otherwise, go to step B).
- **FlowExecution**: Represents an active instance of a customer running through a flow. Tracks variables (inputs) and `pausedUntil` for delay steps.
- **FlowExecutionLog**: Step-by-step history for visual troubleshooting and debugging.

#### Rationale
Using a relational representation for steps, branches, and execution histories makes it possible to perform complex queries (e.g., "how many customers are currently waiting in step 3?") using simple SQL joins, which is much faster than parsing massive JSON blobs.

---

## 3. Seed Logic Enhancements

To support the migration and verify all new models, the seeding logic in `backend/seed.js` must be expanded to:
1. **Clean Slate**: Delete records in the correct dependency order to prevent foreign key errors.
2. **Hashed Passwords**: Seed a default admin and agent using `bcrypt` hashes.
3. **Multi-Platform Connections**: Seed Facebook and WhatsApp connections.
4. **Interactive Inbox**: Seed a conversation with a series of back-and-forth messages (simulating auto-replies).
5. **Campaign Metrics**: Seed a completed marketing campaign with successful and failed delivery logs.
6. **Automation Flow**: Seed a complete 3-step welcome flow featuring triggers, delay nodes, and branching logic.
7. **Active Execution**: Seed an active flow execution paused on a delay node.
8. **Compliance Logs**: Seed audit logs and webhook deduplication records.

The code for the seeding logic is written in `.agents/explorer_m2_3/proposed_seed.js`.

---

## 4. Verification Plan
To verify the new schema and seeding:
1. Spin up a local PostgreSQL instance (e.g., via Docker: `docker run --name pg-neqta -e POSTGRES_DB=neqta -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres`).
2. Update the `.env` file's `DATABASE_URL` to point to PostgreSQL:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/neqta?schema=public"
   ```
3. Run `npx prisma db push` using the proposed schema to ensure all schemas generate correctly on PostgreSQL.
4. Run `node proposed_seed.js` to ensure data populates correctly without foreign key constraint errors or type mismatches.
5. Execute application integration tests (`npm run test` or `npm run test:e2e`).
