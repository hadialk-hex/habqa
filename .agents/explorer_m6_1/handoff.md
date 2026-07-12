# Handoff Report: Hubqa Production Infrastructure (Milestone 6)

## 1. Observation
- **Root Workspace Directory (`c:\Users\pc\Desktop\face bot`)**:
  - Contains `backend/` and `frontend/` subdirectories. No root `docker-compose.yml` or `Makefile` currently exists.
  - Contains `.agents/` folder with previous milestone metadata (e.g. `worker_m2/handoff.md` and `worker_m3/handoff.md` illustrating TDD progress).
- **Backend Codebase (`backend/`)**:
  - `backend/package.json` contains NestJS 11 dependencies. The only dependencies are core modules plus `bcrypt` (native C++ module), `@nestjs/throttler`, and `@prisma/client` (version `5.22.0`). It lacks Redis, queuing (e.g., BullMQ), caching (e.g., cache-manager), and structured logging (e.g., Pino) libraries.
  - `backend/src/app.module.ts` imports standard modules but has no integration for caching, queuing, or JSON logging.
  - `backend/src/main.ts` contains a hardcoded SQLite override:
    ```typescript
    process.env.DATABASE_URL = 'file:./dev.db'; // force sqlite dev db
    ```
    This line will override any PostgreSQL connection string passed via Docker environment variables.
  - `backend/Dockerfile` exists inside the `backend/` subdirectory. It is a multi-stage Alpine build but does not install compilation tools (`make`, `g++`, `gcc`, `python3`) required to compile native `bcrypt` dependencies, which can fail under certain multi-platform builds.
  - `backend/docker-compose.yml` exists inside the `backend/` subdirectory but only spins up PostgreSQL (version `17-alpine`), lacking Redis and NestJS/Next.js services.
- **Frontend Codebase (`frontend/`)**:
  - `frontend/package.json` lists Next.js version `16.2.10` and React `19.2.4`.
  - `frontend/next.config.ts` defines security headers but does **not** include `output: 'standalone'`.
  - `frontend/Dockerfile` exists inside the `frontend/` subdirectory. It is structured to run in `standalone` mode:
    ```dockerfile
    COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
    ```
    Since `output: 'standalone'` is not defined in `next.config.ts`, building this Docker image will fail at the copy stage as the directory will not exist.

---

## 2. Logic Chain
- **Next.js Standalone Build**:
  - Next.js requires `output: 'standalone'` in `next.config.ts` to build a minimal bundle containing only the necessary files (node_modules, server.js, public, .next/static) for production deployment. This keeps the production container size extremely small (~150MB instead of ~800MB).
- **Prisma & Database URLs**:
  - Since `main.ts` overrides `DATABASE_URL` with a SQLite file path, running NestJS in Docker with Postgres will fail unless we make this conditional (e.g., only override during local development or when `NODE_ENV !== 'production'`).
- **Redis Caching & Queuing Integration**:
  - Since the application handles heavy webhook events (Facebook Page Comments, WhatsApp Cloud API messages) and schedules Broadcasts, running these operations synchronously on the main thread is a bottleneck. 
  - **Queuing**: `BullMQ` (via `@nestjs/bullmq` and `bullmq` package) is the recommended standard. It provides robust background processing and job retries backed by Redis.
  - **Caching**: `@nestjs/cache-manager` paired with `cache-manager-redis-yet` connects cache-manager directly to Redis, letting us cache database lookups, channel states, and API responses.
- **Structured JSON Logging**:
  - For cloud native/production environments, logs must be structured as single-line JSON objects to be parsed by logs aggregators (e.g., Datadog, ELK, AWS CloudWatch).
  - `nestjs-pino` wraps `pino` (the fastest Node.js logger) and integrates natively with NestJS, automatically logging HTTP request parameters, timings, and error stack traces in JSON format.
- **Cross-Platform Scripting (Windows & POSIX)**:
  - While a `Makefile` is required for POSIX systems (Linux/macOS), the user runs Windows. A `Makefile` won't execute out-of-the-box in standard cmd/PowerShell without GNU Make. Providing a cross-platform PowerShell companion script (`start-services.ps1`) ensures usability across all OS targets.

---

## 3. Caveats
- **Bcrypt Native Module vs Bcryptjs**:
  - `bcrypt` requires compiling C++ bindings during `npm ci`, which adds overhead and requires system build tools in the Docker container. 
  - Proposing `bcryptjs` as a pure JS drop-in replacement avoids needing compiler dependencies, reduces build times, and guarantees ARM64/AMD64 cross-compatibility without complex setups.
- **Build-Time Environment Variables in Next.js**:
  - Environment variables starting with `NEXT_PUBLIC_` are baked into the Next.js bundle during the build step (`npm run build`). Therefore, the backend API URL (`NEXT_PUBLIC_API_URL`) must be passed as a build argument (`ARG`) in the Dockerfile, rather than just a runtime container environment variable.
- **SQLite Dev Mode**:
  - Developers will need to remember to set `NODE_ENV=production` or `DATABASE_URL` explicitly to disable SQLite and connect to PostgreSQL.

---

## 4. Conclusion & Recommendations

### A. Recommended Libraries to Install

Run the following command inside `backend/` directory to install caching, queuing, and JSON logging libraries:
```bash
npm install @nestjs/cache-manager cache-manager cache-manager-redis-yet @nestjs/bullmq bullmq ioredis nestjs-pino pino-http
npm install --save-dev pino-pretty
```

*Note: For the best and fastest Docker build experience, we recommend replacing native `bcrypt` with `bcryptjs` (pure JS, no native compilation required):*
```bash
npm uninstall bcrypt @types/bcrypt
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

---

### B. Proposed File Modifications (Codebase Changes)

#### 1. Enable Standalone Output in `frontend/next.config.ts`
Modify `frontend/next.config.ts` to include `output: 'standalone'`:
```typescript
import type { NextConfig } from "next";

const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://connect.facebook.net;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://*.fbcdn.net https://*.facebook.com;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
`;

const nextConfig: NextConfig = {
  output: 'standalone', // Added for optimized Docker deployment
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\s{2,}/g, ' ').trim(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

#### 2. Conditionalize Database URL in `backend/src/main.ts`
Allow the system to connect to PostgreSQL in production while maintaining SQLite fallback for local test/dev:
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';

dotenv.config();

// Only force SQLite dev db if not explicitly set to PostgreSQL or running in production
if (process.env.NODE_ENV !== 'production' && !process.env.DATABASE_URL?.startsWith('postgresql')) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true, bufferLogs: true });

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  
  // Use Pino Logger
  try {
    const { Logger } = await import('nestjs-pino');
    app.useLogger(app.get(Logger));
  } catch (e) {
    // Fallback if pino is not installed yet
  }

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
```

#### 3. Integrate Redis Cache, Queues, and Logger in `backend/src/app.module.ts`
Update imports in `app.module.ts` to plug in the infrastructure:
```typescript
import {
  Module,
  NestModule,
  MiddlewareConsumer,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { redisStore } from 'cache-manager-redis-yet';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ChannelsModule } from './channels/channels.module';
import { RulesModule } from './rules/rules.module';
import { InboxModule } from './inbox/inbox.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module'; // Propose HealthModule

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 10000, limit: 15 }]),
    PrismaModule,
    AuthModule,
    ChannelsModule,
    RulesModule,
    InboxModule,
    WebhooksModule,
    DashboardModule,
    HealthModule,
    
    // Structured JSON logging setup
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('NODE_ENV') === 'production' ? 'info' : 'debug',
          transport: config.get<string>('NODE_ENV') !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        },
      }),
    }),

    // Redis caching setup
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: config.get<string>('REDIS_HOST', 'redis'),
            port: parseInt(config.get<string>('REDIS_PORT', '6379'), 10),
          },
          ttl: 60 * 1000, // 1 minute default TTL
        }),
      }),
    }),

    // Redis BullMQ queue setup
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'redis'),
          port: parseInt(config.get<string>('REDIS_PORT', '6379'), 10),
        },
      }),
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, transform: true }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req: any, res: any, next: () => void) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        next();
      })
      .forRoutes('*');
  }
}
```

#### 4. Add Database Healthcheck in `backend/src/health/health.controller.ts`
Implement a simple database and redis connection health check endpoint:
```typescript
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  private redisClient: Redis;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService
  ) {
    this.redisClient = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'redis'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      lazyConnect: true,
    });
  }

  @Get()
  async check() {
    let dbStatus = 'unhealthy';
    let redisStatus = 'unhealthy';
    let errorDetails = {};

    // 1. Check Database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'healthy';
    } catch (e) {
      errorDetails['database'] = e.message;
    }

    // 2. Check Redis
    try {
      await this.redisClient.connect();
      const ping = await this.redisClient.ping();
      if (ping === 'PONG') {
        redisStatus = 'healthy';
      }
      await this.redisClient.quit();
    } catch (e) {
      errorDetails['redis'] = e.message;
    }

    const report = {
      status: dbStatus === 'healthy' && redisStatus === 'healthy' ? 'ok' : 'error',
      details: {
        database: dbStatus,
        redis: redisStatus,
      },
    };

    if (report.status === 'error') {
      throw new ServiceUnavailableException(report);
    }

    return report;
  }
}
```
*(Register this controller in a simple `health.module.ts` and import it into `app.module.ts` as displayed above).*

---

### C. Proposed Infrastructure Files (Root & Sub-directories)

#### 1. Root `docker-compose.yml` (Target: `./docker-compose.yml`)
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:17-alpine
    container_name: hubqa-postgres
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
      POSTGRES_DB: hubqa
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d hubqa"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: hubqa-redis
    restart: always
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD-SHELL", "redis-cli ping | grep PONG"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: hubqa-backend
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - '3001:3001'
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: postgresql://postgres:postgrespassword@postgres:5432/hubqa?schema=public
      REDIS_HOST: redis
      REDIS_PORT: 6379
      JWT_SECRET: "super-secret-key-for-hubqa-change-in-production"
      APP_SECRET: "facebook-app-secret-key"
      ENCRYPTION_KEY: "super-secret-encryption-key-32ch-long-here"
      ALLOWED_ORIGINS: "http://localhost:3000"
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: http://localhost:3001
    container_name: hubqa-frontend
    restart: always
    depends_on:
      backend:
        condition: service_healthy
    ports:
      - '3000:3000'
    environment:
      NODE_ENV: production
      PORT: 3000
      HOSTNAME: "0.0.0.0"
      NEXT_PUBLIC_API_URL: http://localhost:3001
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 15s

volumes:
  postgres_data:
  redis_data:
```

#### 2. Backend `Dockerfile` (Target: `./backend/Dockerfile`)
Supporting native modules compilation on `linux/arm64` and `linux/amd64`:
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
# Install compile dependencies for native C++ modules like bcrypt
RUN apk add --no-cache make gcc g++ python3
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Production Run
FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
# Install build tools for native compilation, install production deps, then remove build tools to slim down image
RUN apk add --no-cache make gcc g++ python3 && \
    npm ci --only=production && \
    apk del make gcc g++ python3
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
```

#### 3. Frontend `Dockerfile` (Target: `./frontend/Dockerfile`)
Using Next.js Standalone build (arm64/amd64 multi-arch ready):
```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Inject build argument into Next.js compile stage
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

#### 4. Root `Makefile` (Target: `./Makefile`)
POSIX compatible CLI scripts:
```makefile
.PHONY: up down restart build logs db-migrate db-seed clean help

help:
	@echo "Hubqa SaaS Production Infrastructure Helper Command Menu:"
	@echo "  make up          - Start all containers in background"
	@echo "  make down        - Stop all containers"
	@echo "  make restart     - Restart all containers"
	@echo "  make build       - Rebuild all container images"
	@echo "  make logs        - Show and tail container logs"
	@echo "  make db-migrate  - Run Prisma production migrations inside backend"
	@echo "  make db-seed     - Execute database seed script inside backend"
	@echo "  make clean       - Remove containers, networks, and persistent data volumes"

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

build:
	docker compose build

logs:
	docker compose logs -f

db-migrate:
	docker compose exec backend npx prisma migrate deploy

db-seed:
	docker compose exec backend npx prisma db seed

clean:
	docker compose down -v
```

#### 5. Windows Companion Script `start-services.ps1` (Target: `./start-services.ps1`)
Cross-platform PowerShell script matching Windows standard execution:
```powershell
# Hubqa SaaS Windows Infrastructure Helper Script

$action = $args[0]

if ($null -eq $action -or $action -eq "help") {
    Write-Host "Hubqa SaaS Windows Infrastructure Helper Command Menu:" -ForegroundColor Cyan
    Write-Host "  .\start-services.ps1 up          - Start all containers in background"
    Write-Host "  .\start-services.ps1 down        - Stop all containers"
    Write-Host "  .\start-services.ps1 restart     - Restart all containers"
    Write-Host "  .\start-services.ps1 build       - Rebuild container images"
    Write-Host "  .\start-services.ps1 logs        - Show and tail container logs"
    Write-Host "  .\start-services.ps1 db-migrate  - Run Prisma production migrations"
    Write-Host "  .\start-services.ps1 db-seed     - Seed default tenant and values"
    Write-Host "  .\start-services.ps1 clean       - Stop containers and purge all volumes"
    Exit 0
}

switch ($action) {
    "up" {
        docker compose up -d
    }
    "down" {
        docker compose down
    }
    "restart" {
        docker compose restart
    }
    "build" {
        docker compose build
    }
    "logs" {
        docker compose logs -f
    }
    "db-migrate" {
        docker compose exec backend npx prisma migrate deploy
    }
    "db-seed" {
        docker compose exec backend npx prisma db seed
    }
    "clean" {
        docker compose down -v
    }
    default {
        Write-Error "Unknown action: $action. Use '.\start-services.ps1 help' for instructions."
    }
}
```

---

## 5. Verification Method

Once the implementer (Implementer 6) applies these configuration changes, the setup can be fully verified using these steps:

1. **Prerequisites & Package Configuration**:
   - Check that `@nestjs/cache-manager`, `cache-manager-redis-yet`, `@nestjs/bullmq`, `bullmq`, `nestjs-pino`, and `pino-http` are present in `backend/package.json`.
   - Run `npm run build` in the backend and ensure no TypeScript compilation issues.
2. **Build and Run Containers**:
   - Run `docker compose build --no-cache` from the root workspace to compile the images for NestJS and Next.js.
   - Run `docker compose up -d`.
   - Run `docker compose ps` to inspect running statuses. Wait for all 4 containers (`hubqa-postgres`, `hubqa-redis`, `hubqa-backend`, and `hubqa-frontend`) to show `healthy`.
3. **Database Migration and Seeding Verification**:
   - Generate local migration files (simulating the developer environment):
     ```bash
     docker compose exec backend npx prisma migrate dev --name init
     ```
   - Execute production migrations:
     ```bash
     make db-migrate  # or .\start-services.ps1 db-migrate
     ```
   - Run seed command:
     ```bash
     make db-seed     # or .\start-services.ps1 db-seed
     ```
     Ensure database seeds successfully.
4. **Health Endpoint Verification**:
   - Query backend health check to verify Postgres and Redis connections are active and reporting healthy:
     ```bash
     curl http://localhost:3001/health
     ```
     Expected response:
     ```json
     {
       "status": "ok",
       "details": {
         "database": "healthy",
         "redis": "healthy"
       }
     }
     ```
5. **Structured Logging Verification**:
   - Monitor backend logs to confirm JSON formatting:
     ```bash
     docker logs hubqa-backend --tail 10
     ```
     Expected format:
     ```json
     {"level":30,"time":1719945600000,"pid":1,"hostname":"hubqa-backend","req":{"id":1,"method":"GET","url":"/health"},"res":{"statusCode":200},"responseTime":12,"msg":"request completed"}
     ```
