#!/bin/sh
set -e

# This project syncs its schema with `prisma db push` (there is no migrations/
# folder), so `prisma migrate deploy` would find nothing and silently leave a
# fresh database with no tables. Push the schema instead: it is idempotent — a
# no-op when the database already matches schema.prisma, and it creates every
# table on a fresh one. --skip-generate: the client is already generated in the
# image. Without --accept-data-loss it fails loudly on a destructive change
# rather than dropping data.
echo "🗄️  Syncing database schema (prisma db push)..."
npx prisma db push --skip-generate

echo "🚀 Starting Hubqa backend..."
exec node dist/main.js
