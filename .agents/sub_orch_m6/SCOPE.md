# Scope: M6_Production_Infrastructure

## Architecture
- **Multi-arch Deployment**: Docker support for both linux/amd64 and linux/arm64.
- **Service Topology**:
  - `postgres` (version 17) - database service with health checks.
  - `redis` (version 7) - in-memory cache and queue broker.
  - `backend` (NestJS) - API service connected to postgres and redis.
  - `frontend` (Next.js) - user interface.
- **Queuing & Caching**: Backend configuration for caching database queries and background job queuing via Redis.
- **Logging**: Structured JSON logging in the backend for observability.
- **Automation**: Makefile at workspace root to automate setup, migrations, seeding, starting, stopping, and logging.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M6_Production_Infrastructure | Multi-arch Dockerfiles, Docker Compose, Redis integration, Winston/Pino JSON logging, Makefile | None | PLANNED |

## Interface Contracts
- **Redis Connection**: Configuration using env vars `REDIS_HOST` and `REDIS_PORT`.
- **Health Checks**:
  - Backend: `GET /api/health` or `GET /health`.
  - Frontend: `GET /` or check webserver status.
  - Postgres: pg_isready healthcheck.
  - Redis: redis-cli ping healthcheck.
