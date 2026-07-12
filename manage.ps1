param (
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet("build", "up", "down", "logs", "restart", "clean", "db-migrate", "db-seed")]
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
    "logs" {
        docker compose logs -f
    }
    "restart" {
        docker compose restart
    }
    "clean" {
        docker compose down -v --rmi all --remove-orphans
    }
    "db-migrate" {
        docker compose run --rm backend npx prisma db push
    }
    "db-seed" {
        docker compose run --rm backend npx prisma db seed
    }
}
