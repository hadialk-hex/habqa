# proposed_start-db.ps1
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
    
    # Common installation paths for Docker Desktop
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
