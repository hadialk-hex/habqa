# Database Migration Probe & Setup Plan

This report documents findings from probing the system's local Docker environment and port availability, and outlines a comprehensive plan for configuring a local PostgreSQL instance for the database migration milestone.

## 1. System Probing Findings

### Docker & Docker Compose Availability
We probed the availability of Docker and Docker Compose CLI commands:
- **Docker CLI**: Installed and accessible.
  - Command: `docker --version`
  - Output: `Docker version 29.4.0, build 9d7ad9f`
- **Docker Compose**: Installed and accessible.
  - Command: `docker compose version`
  - Output: `Docker Compose version v5.1.1`
- **Docker Daemon Status**: **Stopped / Unreachable**.
  - Attempting to list running containers (`docker ps`) returned the following connection error:
    ```
    failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine;
    check if the path is correct and if the daemon is running:
    open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
    ```
    *Conclusion*: Docker Desktop CLI tools are available, but the Docker Desktop daemon service is currently offline.

### Port 5432 Conflict Investigation
We verified if port `5432` is currently occupied by another PostgreSQL instance or conflicting database services:
- **Method**: Executed a Node.js socket server binding check on `127.0.0.1:5432`.
- **Result**: `FREE`
  - The socket server successfully bound to port `5432` without raising an `EADDRINUSE` error.
  - There are no active local PostgreSQL services or conflicting database servers listening on port `5432`.

---

## 2. Proposed PostgreSQL Setup Plan

Since the local Docker daemon is not active, we recommend a dual approach:
1. Provide a **Docker Compose** definition to spin up a PostgreSQL 17 container.
2. Provide a **PowerShell Launch Script** (`start-db.ps1`) to automatically check for Docker, start the Docker Desktop service if it's shut down, run the Compose configuration, and wait for the database health status before proceeding.

### A. Docker Compose File (`docker-compose.yml`)
The proposed configuration uses the official `postgres:17-alpine` image mapping to port `5432` with a persistent database volume:

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
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### B. Launch Automation Script (`start-db.ps1`)
This script automates verifying the environment, starting Docker Desktop, and waiting for the database health check:

```powershell
# Script to verify Docker, start Docker Desktop if needed, and launch the PostgreSQL container.
Write-Host "Verifying Docker installation..." -ForegroundColor Cyan

# 1. Check if docker is installed
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker is not installed or not in system PATH. Please install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    Exit 1
}

# 2. Check if docker daemon is running
$dockerRunning = $false
try {
    $null = docker ps -q 2>&1
    $dockerRunning = $true
} catch {
    $dockerRunning = $false
}

if (-not $dockerRunning) {
    Write-Host "Docker daemon is not running. Attempting to start Docker Desktop..." -ForegroundColor Yellow
    $dockerPaths = @(
        "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe"
    )
    
    $started = $false
    foreach ($path in $dockerPaths) {
        if (Test-Path $path) {
            Start-Process -FilePath $path
            $started = $true
            break
        }
    }
    
    if (-not $started) {
        Write-Error "Could not find Docker Desktop executable in default paths. Please start Docker Desktop manually."
        Exit 1
    }
    
    Write-Host "Waiting for Docker daemon to initialize..." -ForegroundColor Yellow
    $retries = 30
    while ($retries -gt 0) {
        Start-Sleep -Seconds 2
        try {
            $null = docker ps -q 2>&1
            Write-Host "Docker daemon is successfully running." -ForegroundColor Green
            $dockerRunning = $true
            break
        } catch {
            $retries--
            Write-Host "Still waiting ($retries retries left)..."
        }
    }
    
    if (-not $dockerRunning) {
        Write-Error "Failed to start Docker daemon. Please check Docker Desktop application manually."
        Exit 1
    }
} else {
    Write-Host "Docker daemon is already running." -ForegroundColor Green
}

# 3. Start postgres container
Write-Host "Starting PostgreSQL container..." -ForegroundColor Cyan
docker compose -f docker-compose.yml up -d postgres

# 4. Wait for database readiness
Write-Host "Waiting for PostgreSQL database to be healthy..." -ForegroundColor Yellow
$dbHealthy = $false
$retries = 15
while ($retries -gt 0) {
    $healthStatus = docker inspect --format='{{json .State.Health.Status}}' hubqa-postgres 2>$null
    if ($healthStatus -eq '"healthy"') {
        Write-Host "PostgreSQL database is ready to accept connections!" -ForegroundColor Green
        $dbHealthy = $true
        break
    }
    Start-Sleep -Seconds 2
    $retries--
}

if (-not $dbHealthy) {
    Write-Warning "Database container did not reach healthy status within the timeout period. Checking logs:"
    docker logs hubqa-postgres --tail 20
}
```

---

## 3. Database Connection Configuration & Migration Review

To redirect NestJS and Prisma from the legacy SQLite connection to the new PostgreSQL database, update the following configuration files:

### A. Environment File Update (`backend/.env`)
Update the `DATABASE_URL` variable to use the PostgreSQL connection format instead of SQLite:

**Before:**
```env
DATABASE_URL="file:./dev.db"
```

**After:**
```env
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/hubqa?schema=public"
```

### B. Prisma Schema Update (`backend/prisma/schema.prisma`)
The datasource provider block in the schema file must be changed from `sqlite` to `postgresql` so Prisma generates appropriate SQL code:

**Before:**
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

**After:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

*Note:* Enums which were previously simulated using `String` types in SQLite (e.g. `role`, `platform`, `triggerType`, `matchType`, `status`, etc.) can now be transitioned to native PostgreSQL `enum` types if desired, but retaining `String` columns works directly and is backwards-compatible.

### C. Migration Steps
Once files are updated and the local PostgreSQL container is running:
1. Install dependencies and ensure the schema compiles:
   ```bash
   cd backend
   npx prisma generate
   ```
2. Create and run a new database migration targeting PostgreSQL:
   ```bash
   npx prisma migrate dev --name init_postgres
   ```
   *Alternative for rapid dev/test environments (skipping migration history):*
   ```bash
   npx prisma db push
   ```
3. Run the database seed script to populate initial tables (e.g., creating the default Tenant):
   ```bash
   node seed.js
   ```
