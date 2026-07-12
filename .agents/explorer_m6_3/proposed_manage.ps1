# Hubqa Infrastructure Management Helper for Windows

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
        docker compose exec backend npx prisma db seed
    }
    "db-generate" {
        docker compose exec backend npx prisma generate
    }
}
