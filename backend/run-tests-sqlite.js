const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const schemaPath = path.resolve(__dirname, 'prisma/schema.prisma');
const backupPath = path.resolve(__dirname, 'prisma/schema.prisma.bak');

console.log('Starting test runner with SQLite fallback...');

// 1. Backup schema.prisma
fs.copyFileSync(schemaPath, backupPath);
console.log('Backup of schema.prisma created.');

try {
  // 2. Read and modify schema.prisma
  let content = fs.readFileSync(schemaPath, 'utf8');
  
  // Replace provider
  content = content.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
  
  // Remove any postgres-specific attributes if present (like @db.Uuid, @db.Timestamptz, etc.)
  content = content.replace(/@db\.\w+/g, '');
  
  fs.writeFileSync(schemaPath, content, 'utf8');
  console.log('schema.prisma temporarily modified to use SQLite.');

  // 3. Run the E2E tests
  console.log('Running E2E tests...');
  execSync('npx prisma generate && npx prisma db push --accept-data-loss && npm run test:e2e', { stdio: 'inherit' });
  console.log('E2E tests completed successfully.');
} catch (error) {
  console.error('Error during test execution:', error.message);
  process.exitCode = 1;
} finally {
  // 4. Restore schema.prisma
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, schemaPath);
    fs.unlinkSync(backupPath);
    console.log('schema.prisma restored to its original state.');
    try {
      execSync('npx prisma generate', { stdio: 'inherit' });
      console.log('Prisma client restored to PostgreSQL.');
    } catch (restoreError) {
      console.error('Failed to restore Prisma client:', restoreError.message);
    }
  }
}
