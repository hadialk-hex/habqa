import { execSync } from 'child_process';
import * as path from 'path';
import * as dotenv from 'dotenv';

export default async () => {
  console.log('\n=============================================');
  console.log('Starting E2E Global Setup...');
  
  // 1. Load environment variables
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  
  // 2. Resolve database connection string
  const isPostgres = process.env.TEST_DATABASE_URL?.startsWith('postgresql://') || 
                     process.env.DATABASE_URL?.startsWith('postgresql://');
  
  let databaseUrl = '';
  if (isPostgres) {
    databaseUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hubqa_test?schema=public';
  } else {
    const sqliteTestDbPath = path.resolve(__dirname, '../prisma/test.db');
    databaseUrl = `file:${sqliteTestDbPath}`;
  }
  
  // 3. Push schema to the test database
  console.log(`Syncing schema to E2E test database: ${databaseUrl}`);
  try {
    execSync('npx prisma db push --accept-data-loss', {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    });
    console.log('E2E database schema sync completed successfully.');
  } catch (error) {
    console.error('Failed to sync database schema for E2E tests:', error);
    process.exit(1);
  }
  console.log('=============================================\n');
};
