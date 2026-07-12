# Scope: M2_Database_Migration

## Architecture
- Database migration from SQLite to PostgreSQL.
- Modernizing database layer to use native PostgreSQL features (enums, JSON columns, GIN/B-Tree indexes).
- Extension of the database schema to support new features: Broadcasts/Campaigns, Audit Logging, Webhook Deduplication, Password Reset Tokens, Team Roles, Flow Automation.
- Setup of a local PostgreSQL container for local development and verification.
- Update/Write seeding logic compatible with PostgreSQL schema.

## Milestones/Sub-tasks
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Infrastructure Setup | Set up local PostgreSQL via Docker/docker-compose or startup script | None | PLANNED |
| 2 | Schema Migration Analysis | Analyze schema.prisma and design new PostgreSQL model additions, indexes, enums, JSON types | M1 | PLANNED |
| 3 | Schema Implementation | Update schema.prisma and generate Prisma client | M2 | PLANNED |
| 4 | Seeding Logic Enhancement | Implement seeding script for initial setup in PostgreSQL | M3 | PLANNED |
| 5 | Validation and Testing | Verify schema validate, compile, run migrations, run seed, test queries | M4 | PLANNED |

## Interface Contracts
### Prisma Client ↔ Application Code
- Any schema changes must keep the existing models' fields compatible (e.g. converting `String` fields like `plan`, `role`, `platform`, `triggerType`, `matchType`, `status`, `direction`, `messageType` to actual PostgreSQL Enums, and JSON strings like `replyMedia`, `privateMedia`, `metaData` to actual `Json` fields).
- Ensure existing fields are not broken, or if they are typed differently, verify that NestJS controllers and services can still use them or that proper mappings/adjustments are planned.
