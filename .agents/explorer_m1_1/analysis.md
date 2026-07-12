# NestJS Backend & E2E Testing Infrastructure Analysis

## 1. Executive Summary
This report analyzes the NestJS backend structure, Prisma database setup, and current E2E testing framework in the Hubqa project. It identifies critical database isolation risks (specifically that E2E tests currently read/write to the active development database) and proposes a portable, high-performance database isolation, migration, seeding, and cleanup strategy designed to support both the current SQLite setup and the upcoming PostgreSQL migration.

---

## 2. NestJS Backend Structure & Database Setup
The NestJS backend application (`backend/`) is structured into distinct, modular domain components:
*   **`AuthModule`**: Handles user authentication, registration, login, and JWT payload/verification (using Passport/JWT).
*   **`ChannelsModule`**: Manages connected third-party messaging platforms (Facebook Pages, Instagram Accounts, WhatsApp Phone Numbers).
*   **`RulesModule`**: Manages automated keyword/action matching and trigger logic (e.g. Comment-to-DM auto-replies).
*   **`InboxModule`**: Governs the unified inbox containing conversations and message logs.
*   **`WebhooksModule`**: Handles inbound Meta API payload processing and webhook route validation.
*   **`DashboardModule`**: Generates analytics and KPI metrics.
*   **`PrismaModule`**: Provides a global `PrismaService` wrapper for Prisma Client to communicate with the database.

### Database Setup & Inconsistency Risk
*   **ORM**: Prisma ORM v5.22.0.
*   **Current Provider**: SQLite, pointing to `DATABASE_URL` env variable.
*   **Development Config**: `DATABASE_URL="file:./dev.db"` is set in `.env` and overridden in `main.ts` as `process.env.DATABASE_URL = "file:./dev.db"`.
*   **Path Resolution Inconsistency**:
    *   **Prisma CLI** (migrations/pushes) resolves relative file paths relative to `prisma/schema.prisma` location. Therefore, `npx prisma db push` modifies `backend/prisma/dev.db`.
    *   **NestJS App Runtime** resolves relative file paths relative to the Current Working Directory (CWD) of the node process. When run via `npm run start` inside the `backend/` directory, it reads/writes to `backend/dev.db`.
    *   This leads to two separate SQLite files being generated and used (`backend/prisma/dev.db` and `backend/dev.db`), causing potential schema mismatch issues if not resolved.

---

## 3. E2E Test Setup Analysis
The backend contains a minimal E2E test framework:
*   **Configuration (`backend/test/jest-e2e.json`)**:
    *   Configures `ts-jest` for transpilation, sets test environment to `node`, and targets files ending in `.e2e-spec.ts`.
*   **Initial Test (`backend/test/app.e2e-spec.ts`)**:
    *   A single test verifying `GET /` returning `Hello World!`.
    *   Initializes the NestJS application container inside `beforeEach` and closes it inside `afterEach`.
*   **Execution**:
    *   Runs via `npm run test:e2e` inside the `backend/` directory.
*   **Key Issues Identifed**:
    1.  **No Database Isolation**: E2E tests currently read the `.env` file containing `DATABASE_URL="file:./dev.db"`. If tests execute any database-related endpoints, they read and write to the development database, corrupting development data.
    2.  **Slow App Re-Compilation**: Compiling the `AppModule` and initializing/closing the application inside `beforeEach`/`afterEach` for *every individual test case* introduces substantial overhead. In a suite of 135+ tests, this will result in slow test execution.

---

## 4. Proposed Database Isolation & Cleanup Strategy
To address these issues and accommodate the planned PostgreSQL migration, we propose the following multi-stage strategy:

### 1. Environment & Path Isolation
Configure Jest to load a separate setup file that overrides environment variables for E2E tests, ensuring they never target the development database.
*   To resolve the SQLite relative path resolution discrepancy, we dynamically resolve the test database file to an **absolute path** inside the `prisma/` folder (e.g., `backend/prisma/test.db`). Both Prisma CLI commands and NestJS application runs will resolve this to the exact same file.
*   To support the future PostgreSQL migration, the setup checks if PostgreSQL environment variables are provided and falls back to a PostgreSQL connection string.

### 2. Schema Provisioning (Migrations)
Execute schema provisioning once before all tests run to ensure the test database is aligned with the codebase schema.
*   We use a Jest `globalSetup` script that runs `npx prisma db push --accept-data-loss` once before the test runner initializes any worker processes. This keeps the schema in sync with zero overhead.

### 3. Fast Data Cleanup (Test Isolation)
To guarantee that test cases do not leak state, all tables must be cleaned up before each test case runs.
*   **SQLite**: Bypasses foreign key constraints using `PRAGMA foreign_keys = OFF;`, deletes all records across all tables, and restores the constraints.
*   **PostgreSQL**: Performs a native, highly efficient cascaded truncation: `TRUNCATE TABLE "User", "Tenant", ... RESTART IDENTITY CASCADE;`.
*   A unified cleaner utility will dynamically detect the database provider and execute the appropriate cleanup queries.

### 4. Dynamic Seeding
Instead of relying on database seeds created during migration, tests should dynamically seed required global data (such as a default Tenant) programmatically after cleanup. This ensures that every test case starts with a predictable, clean seed state.

### 5. Compilation Performance Optimization
Migrate the NestJS testing module creation and server initialization to `beforeAll` / `afterAll` hooks within each test suite. The database cleanup and seed helpers will run in `beforeEach` to guarantee data isolation without the cost of rebuilding the NestJS container for every test.

---

## 5. Proposed Implementation Artifacts
The following helper files have been written to the `.agents/explorer_m1_1/` directory as proposed templates for the implementation phase:

1.  **`proposed_jest-e2e.json`**: Integrates Jest setup scripts.
2.  **`proposed_setup.ts`**: Sets environment variables (with absolute path SQLite resolution) in the test process.
3.  **`proposed_global-setup.ts`**: Handles pre-test database migrations/pushes.
4.  **`proposed_db-cleanup.ts`**: Contains clean/seed functions supporting both SQLite and PostgreSQL.
5.  **`proposed_app.e2e-spec.ts`**: Demonstrates the optimized test suite template.
