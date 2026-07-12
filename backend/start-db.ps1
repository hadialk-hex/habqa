# Script to verify Docker, start Docker Desktop if needed, and launch the PostgreSQL container.

Write-Host "Verifying Docker installation..." -ForegroundColor Cyan

# 1. Check if docker is installed
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker is not installed or not in system PATH. Please install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    Exit 1
}

# 2. Check if docker daemon is running
Write-Host "Checking if Docker daemon is running..." -ForegroundColor Cyan
& docker ps -q >$null 2>&1
if ($LASTEXITCODE -ne 0) {
    $dockerRunning = $false
} else {
    $dockerRunning = $true
}

if (-not $dockerRunning) {
    Write-Host "Docker daemon is not running. Attempting to start Docker Desktop..." -ForegroundColor Yellow
    
    # Common installation paths for Docker Desktop
    $dockerPaths = @(
        "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
        "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    )
    
    $started = $false
    foreach ($path in $dockerPaths) {
        if (Test-Path $path) {
            Write-Host "Found Docker Desktop at: $path" -ForegroundColor Green
            Start-Process -FilePath $path
            $started = $true
            break
        }
    }
    
    if (-not $started) {
        # Check if docker service can be started
        Write-Host "Could not find Docker Desktop executable in default paths. Attempting to start service..." -ForegroundColor Yellow
        Start-Service -Name "docker" -ErrorAction SilentlyContinue
    }
    
    Write-Host "Waiting for Docker daemon to initialize..." -ForegroundColor Yellow
    $retries = 45
    while ($retries -gt 0) {
        Start-Sleep -Seconds 2
        & docker ps -q >$null 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Docker daemon is successfully running." -ForegroundColor Green
            $dockerRunning = $true
            break
        } else {
            $retries--
            Write-Host "Still waiting for Docker daemon ($retries retries left)..."
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
$retries = 30
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
    Exit 1
}
