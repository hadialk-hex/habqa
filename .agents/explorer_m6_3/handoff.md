# Handoff Report: M6 Production Infrastructure (Explorer 3)

## 1. Observation
We have inspected the codebase at `c:\Users\pc\Desktop\face bot` and observed the following:

1. **Project Directory Structure**:
   - `backend/` -> NestJS Backend application.
   - `frontend/` -> Next.js Frontend application.
   - There are no pre-existing Dockerfiles, `docker-compose.yml`, `Makefile`, or other deployment configuration files in the root or module directories.

2. **Backend Config & Dependencies** (`backend/package.json`):
   - Dependencies include NestJS v11 core packages (`@nestjs/common`, `@nestjs/core` at version `^11.0.1`), Prisma Client (`5.22.0`), `@nestjs/throttler` (`^6.5.0`), and passport/auth packages.
   - **Caching and Queuing**: There are no Redis, Caching, or Queuing packages installed in the dependencies. No `@nestjs/cache-manager`, `cache-manager`, `@nestjs/bull`, `@nestjs/bullmq`, `bull`, `bullmq`, `ioredis`, or similar.
   - **Logging**: No custom logging libraries such as `winston`, `nest-winston`, `nestjs-pino`, or `pino` are installed. Only the default NestJS built-in logger is available.

3. **Database Configuration**:
   - `backend/src/main.ts` (lines 6-7) contains:
     ```typescript
     dotenv.config();
     process.env.DATABASE_URL = 'file:./dev.db'; // force sqlite dev db
     ```
     This forces the SQLite database file and overrides any `DATABASE_URL` environment variable passed into the container.
   - `backend/prisma/schema.prisma` (lines 8-11) defines the sqlite provider:
     ```prisma
     datasource db {
       provider = "sqlite"
       url      = env("DATABASE_URL")
     }
     ```
     This provider is not compatible with production PostgreSQL out-of-the-box without modifying the provider string.
   - `backend/seed.js` is a script configured to seed a demo tenant, but there is no `"prisma": { "seed": "node seed.js" }` configuration block in `backend/package.json` to run seeding using the standard `npx prisma db seed` CLI command.

4. **Frontend Config & Dependencies** (`frontend/package.json` & `frontend/next.config.ts`):
   - Frontend is built on Next.js `16.2.10` and React `19.2.4`.
   - `frontend/next.config.ts` does not contain the `output: 'standalone'` build configuration option, meaning Next.js builds default output without dependency optimization.

---

## 2. Logic Chain

1. **Next.js Standalone Mode Optimization**:
   - Next.js 16 projects are optimized for production deployments inside Docker containers by configuring `output: 'standalone'` in `next.config.ts`. This instructs Next.js to package only the production dependencies and files required to run the server in a separate folder (`.next/standalone`), reducing the resulting container image size from >1GB to ~120MB.

2. **Transitioning SQLite to PostgreSQL 17**:
   - The project roadmap (Milestone 2) specifies migrating the schema to PostgreSQL.
   - To make the infrastructure flexible, the `backend/prisma/schema.prisma` datasource provider must be changed to `"postgresql"`.
   - In `backend/src/main.ts`, the hardcoded statement `process.env.DATABASE_URL = 'file:./dev.db'` must be modified to allow environment variable overrides. If `process.env.DATABASE_URL` is already set (which will occur in Docker Compose via `DATABASE_URL`), it must not be overwritten by the sqlite file path.

3. **Multi-Arch builds (linux/arm64)**:
   - To build and run multi-arch images natively or via emulation, native dependencies (like `bcrypt` in backend) and Prisma engines must be compiled and retrieved for the target runner architecture.
   - In NestJS `Dockerfile`, copying built node_modules or using `npm ci` inside a multi-stage process ensures proper separation of build-time and run-time architectures. Running `npx prisma generate` in the final production stage triggers the download of the correct target platform-specific Prisma Query Engine binary.

4. **Redis Integration (Caching & Queuing)**:
   - For caching, the standard and most robust combination in NestJS 11 is `@nestjs/cache-manager`, `cache-manager` and `cache-manager-redis-yet`.
   - For queuing, the recommended approach for modern NestJS applications is `@nestjs/bullmq` and `bullmq` alongside `ioredis` (BullMQ is faster, actively maintained, and leverages Redis Streams and event loops).
   - These libraries should be registered asynchronously in the backend's root `AppModule` using `ConfigService` to read `REDIS_HOST` and `REDIS_PORT`.

5. **Structured JSON Logging**:
   - Standard stdout JSON logging is required for modern observability in production.
   - `nestjs-pino` and `pino` are recommended over Winston. Pino has significantly lower overhead (approx. 5x faster than Winston) and provides seamless out-of-the-box NestJS middleware mapping to automatically format HTTP logs, trace request IDs, and output clean JSON in production (while using `pino-pretty` to keep logs human-readable in development).

6. **Tooling & Health checks**:
   - The compose file must run Postgres:17, Redis:7, backend, and frontend.
   - To prevent the backend from crashing upon boot, a health check must be defined for Postgres (`pg_isready`) and Redis (`redis-cli ping`), and the backend service must depend on them using `condition: service_healthy`.
   - Since the runner containers use minimal Alpine Node base images (which lack `curl` or `wget`), backend and frontend health checks are best implemented using a lightweight, native inline Node script: `node -e "require('http').get(...)"`.
   - Admin tasks (migrations, seeding, restarts) are automated using a root `Makefile` for Unix-like systems, complemented by a `manage.ps1` PowerShell script to guarantee a native Windows administrative interface.

---

## 3. Caveats
- **Prisma Schema Update**: This infrastructure design assumes that the SQLite schema has been updated to PostgreSQL (e.g. `provider = "postgresql"` in `prisma/schema.prisma`) as part of Milestone 2.
- **Offline Mode constraints**: In local/offline dev setups or under strict proxy restrictions, pulling dependencies (like the Prisma binary or new npm packages) requires internet access. If internet access is not available, the cache/binaries must be pre-fetched.
- **Environment Variables**: A `.env` file containing production secrets (like `JWT_SECRET`, `DB_PASSWORD`, and Social/API credentials) must be created at the workspace root before starting Compose.

---

## 4. Conclusion & Recommendations

### Recommended Dependencies to Install
The following packages must be installed in the respective applications:

#### Backend:
```bash
# Add caching, queuing, and JSON logging libraries
npm install @nestjs/cache-manager cache-manager cache-manager-redis-yet @nestjs/bullmq bullmq ioredis nestjs-pino pino

# Add pino-pretty for readable local development logging
npm install --save-dev pino-pretty
```

#### Frontend:
No additional libraries are required for the frontend Docker deployment.

---

### Proposed Code Changes & Configurations

#### A. Backend Database Connection Override (`backend/src/main.ts`):
Modify the database connection setup to respect environment variables:
```typescript
// BEFORE (Lines 6-7)
dotenv.config();
process.env.DATABASE_URL = 'file:./dev.db'; // force sqlite dev db

// AFTER (Proposed)
dotenv.config();
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db'; // fallback to sqlite in dev if not defined
}
```

#### B. Next.js Output Standalone (`frontend/next.config.ts`):
Configure standalone output in Next.js config:
```typescript
// Proposed next.config.ts configuration
const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() { ... }
};
```

#### C. Redis Caching, Queuing & Pino Logger Registration (`backend/src/app.module.ts`):
Import and configure Cache, Bull, and Pino modules:
```typescript
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 10000, limit: 15 }]),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        pinoHttp: {
          transport: config.get('NODE_ENV') !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
          level: config.get('LOG_LEVEL') || 'info',
        },
      }),
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: config.get('REDIS_HOST') || 'localhost',
            port: parseInt(config.get('REDIS_PORT') || '6379', 10),
          },
        }),
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST') || 'localhost',
          port: parseInt(config.get('REDIS_PORT') || '6379', 10),
        },
      }),
    }),
    PrismaModule,
    AuthModule,
    // ... other modules
  ]
})
```

#### D. Custom Health Check Controller (`backend/src/app.controller.ts` or custom file):
Implement a simple health check route for the database status:
```typescript
import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async checkHealth(@Res() res) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return res.status(HttpStatus.OK).json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'error',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
```

---

### Proposed Infrastructure Files
We have written the complete configuration files in the working directory `c:\Users\pc\Desktop\face bot\.agents\explorer_m6_3\`:
1. `proposed_backend_Dockerfile` -> Deployment Dockerfile for NestJS backend (multi-stage, multi-arch support).
2. `proposed_frontend_Dockerfile` -> Deployment Dockerfile for Next.js frontend (utilizing output standalone mode).
3. `proposed_docker-compose.yml` -> Complete Docker Compose setup integrating Postgres:17, Redis:7, NestJS, and Next.js.
4. `proposed_Makefile` -> Task automation Makefile (migrate, seed, restart, clean).
5. `proposed_manage.ps1` -> Equivalent Windows PowerShell utility for host-native execution.

---

## 5. Verification Method

1. **Verify Local Docker builds (supporting multi-arch arm64/amd64)**:
   Ensure Docker Desktop is running and run the following command to build the stack:
   ```bash
   # Using Makefile
   make build

   # Or using PowerShell on Windows
   .\manage.ps1 build
   ```

2. **Verify Multi-container Orchestration**:
   Spin up the services:
   ```bash
   make up
   # or
   .\manage.ps1 up
   ```
   Check status and logs to verify healthy starts:
   ```bash
   make ps
   make logs
   ```
   Verify that Postgres is listening on port `5432` and Redis is listening on `6379`.

3. **Verify Database Seeding**:
   Trigger seeding within the active backend container:
   ```bash
   make db-seed
   # or
   .\manage.ps1 db-seed
   ```
   Confirm "Demo tenant seeded" is outputted to console.

4. **Verify Health Endpoints**:
   Check the NestJS backend health status:
   ```bash
   curl -i http://localhost:3001/health
   ```
   Expected response: Status `200 OK` with `{"status":"ok","database":"connected",...}`.

5. **Verify Caching, Queuing & Structured Logging**:
   Check the logs using `make logs-backend` (or `.\manage.ps1 logs-backend`). The logs should be printed in structured JSON format (Pino logger output). Try hitting endpoints to see incoming request tracking logs.
