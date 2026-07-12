# Handoff Report: Milestone 6 Production Infrastructure

## 1. Observation
We have inspected the codebase at `c:\Users\pc\Desktop\face bot` and observed the following details:

1. **Workspace Layout**:
   - NestJS Backend: Located in `backend/` directory. Contains `package.json`, `tsconfig.json`, `prisma/schema.prisma`, and `src/`.
   - Next.js Frontend: Located in `frontend/` directory. Contains `package.json` and `next.config.ts`.
   - No existing Dockerfiles, `docker-compose.yml`, `Makefile`, or orchestration files exist in the project root or sub-folders.

2. **Backend Dependencies and Configurations** (`backend/package.json`):
   - Dependencies: Standard NestJS v11 core packages (`@nestjs/common`, `@nestjs/core` at version `^11.0.1`), Prisma Client (`5.22.0`), `@nestjs/throttler` (`^6.5.0`), and passport/auth packages.
   - Caching/Queuing: No caching (`cache-manager`) or queuing (`bull` / `bullmq`) packages are installed in the backend.
   - Logging: No custom structured logging packages are installed. Only the default NestJS built-in logger is present in `webhooks.service.ts` (lines 1, 6).

3. **Prisma Database Provider** (`backend/prisma/schema.prisma` lines 8-11):
   - Current database is configured as:
     ```prisma
     datasource db {
       provider = "sqlite"
       url      = env("DATABASE_URL")
     }
     ```
   - Main entrypoint `backend/src/main.ts` (line 7) contains:
     ```typescript
     process.env.DATABASE_URL = 'file:./dev.db'; // force sqlite dev db
     ```
     This line hardcodes the SQLite database URL and overrides any environment variables passed at runtime.

4. **Frontend Configuration** (`frontend/package.json` & `frontend/next.config.ts`):
   - Uses Next.js `16.2.10` and React `19.2.4`.
   - `frontend/next.config.ts` does not contain `output: 'standalone'` build optimizations.

5. **Existing E2E Tests for Health Checks** (`backend/test/health.e2e-spec.ts` lines 56-76):
   - Contains tests targeting GET `/health`, which checks if the response body contains `{"status": "ok"}` and `{"details": {"database": {"status": "up"}}}`.
   - The backend `/health` endpoint is not currently defined in `app.module.ts` or `app.controller.ts`.

---

## 2. Logic Chain

1. **Multi-Arch builds (linux/arm64)**:
   - For NestJS, standard Alpine Node base images (`node:20-alpine`) support multi-arch targets natively. However, building C++ binaries (e.g., `bcrypt` package) and using Prisma requires installing build tools (`python3`, `make`, `g++`) and `openssl` in the builder stage.
   - Prisma Client requires correct native query engines. If `npm ci --omit=dev` is run on the production stage, the Prisma CLI (which is a devDependency) is removed. If we try to run `npx prisma generate` in the runner stage without the CLI, it fails or must fetch the CLI online.
   - *Design Decision*: Generate the Prisma Client in the builder stage, and copy the generated `node_modules/.prisma` and `node_modules/@prisma/client` directories directly to the runner stage. This guarantees that the pre-generated engines are available in production without needing the devDependency CLI.

2. **Next.js Standalone Mode**:
   - Standard Next.js builds contain massive `node_modules` folders. Next.js 16 supports `output: 'standalone'` in `next.config.ts`, which compiles and bundles the minimum dependency footprint to run the server at `.next/standalone/server.js`.
   - *Design Decision*: Recommend configuring standalone output in `next.config.ts` and copying only `.next/standalone`, `.next/static`, and `public` to the production container. This reduces the image footprint from ~1GB to ~120MB.

3. **Redis Caching & Queuing (BullMQ)**:
   - *Caching Choice*: Recommend `@nestjs/cache-manager` and `cache-manager-redis-yet` (which uses the modern `redis` client underneath and is compatible with NestJS 11/cache-manager v5).
   - *Queuing Choice*: Recommend `@nestjs/bullmq` and `bullmq` alongside `ioredis` as the broker connector. BullMQ is the modern successor to Bull, supporting Redis streams, improved event loops, and lower CPU footprint.
   - *Architectural Fit*: In Facebook comment webhooks, the backend must return a HTTP status code to Facebook within 3 seconds, or the webhook call is retried and eventually disabled. Processing rules and calling Facebook Graph APIs synchronously in `webhooks.service.ts` can easily exceed 3s under load. Placing webhook comment payloads into a BullMQ queue and returning `200 OK` immediately satisfies Facebook's constraint.

4. **Structured JSON Logging (Pino vs Winston)**:
   - Pino is highly performant (up to 5x faster than Winston) and outputs structured JSON by default. `nestjs-pino` integrates with NestJS automatically via middleware, mapping requests and trace IDs, and outputs clean logs that are easily indexed by observability collectors.
   - *Design Decision*: Recommend `nestjs-pino` and `pino` with `pino-pretty` configured only in non-production environments to keep local terminal logs human-readable.

5. **Multi-Container Orchestration & Health Checks**:
   - `docker-compose.yml` must orchestrate `postgres:17-alpine`, `redis:7-alpine`, the NestJS backend, and the Next.js frontend.
   - To prevent the backend and frontend from failing to connect on startup, proper health checks must be enforced. Since minimal Alpine images lack `curl` or `wget`, health checks for the Node services should utilize native inline Node HTTP calls: `node -e "require('http').get(...)"`.

6. **Automation**:
   - Since the developer runs on Windows, providing only a Unix `Makefile` is insufficient. Providing a dual automated toolset:
     - Root `Makefile` for Linux/macOS environments.
     - Root `manage.ps1` PowerShell script for native Windows PowerShell execution.

---

## 3. Caveats
- **Prisma Datasource Provider**: This infrastructure design assumes that the SQLite schema is migrated to PostgreSQL (e.g. `provider = "postgresql"` in `prisma/schema.prisma`) as part of Milestone 2.
- **Environment Configuration**: A `.env` file at the root containing production secrets (such as `JWT_SECRET`, `DB_PASSWORD`, and API tokens) must be populated before starting the docker compose containers.
- **Offline Environments**: If builds are run in offline/restricted network environments, the Prisma engine binaries must be pre-fetched, or proxy settings configured.

---

## 4. Conclusion & Recommendations

### Proposed Dependency Installations

#### NestJS Backend:
```bash
# Install caching, queuing, and Pino structured logging
npm install @nestjs/cache-manager cache-manager cache-manager-redis-yet @nestjs/bullmq bullmq ioredis nestjs-pino pino

# Install developer pretty printing for local logs
npm install --save-dev pino-pretty
```

#### Next.js Frontend:
No extra dependencies are required.

---

### Code Modification Recommendations (Read-Only references)

#### 1. Database Connection Hardcode Fix (`backend/src/main.ts`):
Modify lines 6-7 to allow environment variable overrides:
```typescript
dotenv.config();
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db'; // fallback to sqlite in dev if env var is empty
}
```

#### 2. Next.js Standalone Optimization (`frontend/next.config.ts`):
Add the standalone build flag to next config:
```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() { ... }
};
```

#### 3. Module Configuration (`backend/src/app.module.ts`):
Configure the newly installed services:
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
    // ... other modules
  ]
})
```

#### 4. Health Check Controller (`backend/src/health/health.controller.ts`):
Create a dedicated controller to satisfy `test/health.e2e-spec.ts`:
```typescript
import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async checkHealth(@Res() res) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return res.status(HttpStatus.OK).json({
        status: 'ok',
        details: {
          database: {
            status: 'up'
          }
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'error',
        details: {
          database: {
            status: 'down',
            error: error.message
          }
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
```

---

### Proposed Infrastructure Files

#### file:///c:/Users/pc/Desktop/face%20bot/backend/Dockerfile
```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install tools needed for native node_modules build and prisma client
RUN apk add --no-cache python3 make g++ openssl

COPY package*.json ./
RUN npm ci

COPY . .

# Generate Prisma Client and build app
RUN npx prisma generate
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Install runtime openssl for Prisma engines
RUN apk add --no-cache openssl

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/seed.js ./seed.js
# Copy generated Prisma Client files from builder stage
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3001

CMD ["node", "dist/main.js"]
```

#### file:///c:/Users/pc/Desktop/face%20bot/frontend/Dockerfile
```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/.next/standalone ./
COPY --from=builder /usr/src/app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
```

#### file:///c:/Users/pc/Desktop/face%20bot/docker-compose.yml
```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: hubqa-postgres
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres_password_2026}
      POSTGRES_DB: ${DB_NAME:-hubqa}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  redis:
    image: redis:7-alpine
    container_name: hubqa-redis
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --save 60 1 --loglevel warning
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: hubqa-backend
    restart: always
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-postgres_password_2026}@postgres:5432/${DB_NAME:-hubqa}?schema=public
      REDIS_HOST: redis
      REDIS_PORT: 6379
      ALLOWED_ORIGINS: http://localhost:3000,http://127.0.0.1:3000
      JWT_SECRET: ${JWT_SECRET:-super_secret_jwt_key_2026_change_me}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3001/health', (res) => res.statusCode === 200 ? process.exit(0) : process.exit(1))"]
      interval: 15s
      timeout: 10s
      retries: 3
      start_period: 15s

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: hubqa-frontend
    restart: always
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      NEXT_PUBLIC_API_URL: http://localhost:3001
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000', (res) => res.statusCode === 200 ? process.exit(0) : process.exit(1))"]
      interval: 15s
      timeout: 10s
      retries: 3
      start_period: 15s

volumes:
  postgres_data:
  redis_data:
```

#### file:///c:/Users/pc/Desktop/face%20bot/Makefile
```makefile
# Hubqa Infrastructure Automation Makefile

.PHONY: help build up down restart logs logs-backend logs-frontend ps clean db-migrate db-seed db-generate

SHELL := /bin/bash

help:
	@echo "Available commands:"
	@echo "  make build          - Build production Docker images"
	@echo "  make up             - Start containers in background"
	@echo "  make down           - Stop all containers"
	@echo "  make restart        - Restart the stack"
	@echo "  make logs           - Stream all logs"
	@echo "  make logs-backend   - Stream backend logs"
	@echo "  make logs-frontend  - Stream frontend logs"
	@echo "  make ps             - Show status of services"
	@echo "  make clean          - Destroy containers, volumes, and temporary local builds"
	@echo "  make db-migrate     - Run production database migrations"
	@echo "  make db-seed        - Seed the database inside container"
	@echo "  make db-generate    - Generate Prisma Client inside container"

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-frontend:
	docker compose logs -f frontend

ps:
	docker compose ps

clean:
	docker compose down -v --remove-orphans
	rm -rf backend/dist backend/node_modules frontend/.next frontend/node_modules

db-migrate:
	docker compose exec backend npx prisma migrate deploy

db-seed:
	docker compose exec backend node seed.js

db-generate:
	docker compose exec backend npx prisma generate
```

#### file:///c:/Users/pc/Desktop/face%20bot/manage.ps1
```powershell
# Hubqa Infrastructure Helper Script for Windows PowerShell

param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("build", "up", "down", "restart", "logs", "logs-backend", "logs-frontend", "ps", "clean", "db-migrate", "db-seed", "db-generate")]
    [string]$Action
)

switch ($Action) {
    "build" {
        docker compose build
    }
    "up" {
        docker compose up -d
    }
    "down" {
        docker compose down
    }
    "restart" {
        docker compose restart
    }
    "logs" {
        docker compose logs -f
    }
    "logs-backend" {
        docker compose logs -f backend
    }
    "logs-frontend" {
        docker compose logs -f frontend
    }
    "ps" {
        docker compose ps
    }
    "clean" {
        docker compose down -v --remove-orphans
        Remove-Item -Recurse -Force backend/dist, backend/node_modules, frontend/.next, frontend/node_modules -ErrorAction SilentlyContinue
    }
    "db-migrate" {
        docker compose exec backend npx prisma migrate deploy
    }
    "db-seed" {
        docker compose exec backend node seed.js
    }
    "db-generate" {
        docker compose exec backend npx prisma generate
    }
}
```

---

## 5. Verification Method

To independently verify the recommendations:

1. **Local Compilation/Mock Check**:
   - Add `"prisma": { "seed": "node seed.js" }` to `backend/package.json`.
   - Install packages: `npm install` inside `backend/` and `frontend/` (needs internet).
   - Ensure the Next.js frontend has `output: 'standalone'` added.

2. **Docker Orchestration Verification**:
   - Run building command: `.\manage.ps1 build` (Windows) or `make build` (macOS/Linux).
   - Start the stack: `.\manage.ps1 up` or `make up`.
   - Confirm all 4 services (postgres, redis, backend, frontend) show `healthy` state:
     `.\manage.ps1 ps` or `make ps`.

3. **Prisma & DB Verification**:
   - Seed database inside backend container: `.\manage.ps1 db-seed` or `make db-seed`. Verify "Demo tenant seeded" is outputted.
   - Run DB healthcheck manually:
     `curl -i http://localhost:3001/health`
     Should return a `200 OK` response with:
     ```json
     {"status":"ok","details":{"database":{"status":"up"}}}
     ```

4. **Observability and Logs**:
   - Call any test API endpoint (e.g. `http://localhost:3001/`) and verify backend output is structured JSON logs in Pino format:
     `.\manage.ps1 logs-backend` or `make logs-backend`.
