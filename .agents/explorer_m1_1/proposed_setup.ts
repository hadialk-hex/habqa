import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from the backend root .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Detect if we should use PostgreSQL (future migration) or SQLite (current setup)
const isPostgres = process.env.TEST_DATABASE_URL?.startsWith('postgresql://') || 
                   process.env.DATABASE_URL?.startsWith('postgresql://');

if (isPostgres) {
  // Use PostgreSQL test database URL
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hubqa_test?schema=public';
  console.log(`[E2E Setup] Using PostgreSQL test database: ${process.env.DATABASE_URL}`);
} else {
  // Resolve an absolute path to the SQLite test database file to prevent inconsistency
  // between Prisma CLI context (relative to schema.prisma) and NestJS runtime context (relative to working directory)
  const sqliteTestDbPath = path.resolve(__dirname, '../prisma/test.db');
  process.env.DATABASE_URL = `file:${sqliteTestDbPath}`;
  console.log(`[E2E Setup] Using SQLite test database: ${process.env.DATABASE_URL}`);
}
