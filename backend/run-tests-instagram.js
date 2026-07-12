const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const schemaPath = path.resolve(__dirname, 'prisma/schema.prisma');
const backupPath = path.resolve(__dirname, 'prisma/schema.prisma.bak');
const prismaPath = 'node node_modules/prisma/build/index.js';

console.log('Instagram SQLite Test Runner starting (offline mode)...');

// 1. Backup schema.prisma
if (fs.existsSync(backupPath)) {
  fs.unlinkSync(backupPath);
}
fs.copyFileSync(schemaPath, backupPath);
console.log('Backup of schema.prisma created.');

try {
  let content = fs.readFileSync(schemaPath, 'utf8');

  // Change provider to sqlite
  content = content.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');

  // Remove postgres-specific attributes
  content = content.replace(/@db\.\w+/g, '');

  // Change all Json types to String
  content = content.replace(/\bJson\b/g, 'String');

  // Change all String[] types to String
  content = content.replace(/String\[\]/g, 'String');

  // Identify all enums defined in the schema
  const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
  const enums = [];
  let match;
  while ((match = enumRegex.exec(content)) !== null) {
    enums.push(match[1]);
  }

  // Remove all enum definitions
  content = content.replace(/enum\s+\w+\s*\{[^}]+\}/g, '');

  // For each enum, replace its usage in models with String.
  for (const enumName of enums) {
    const defaultRegex = new RegExp(`(\\b\\w+\\s+)${enumName}(\\s+@default\\()(\\w+)(\\))`, 'g');
    content = content.replace(defaultRegex, '$1String$2"$3"$4');

    const typeRegex = new RegExp(`(\\b\\w+\\s+)${enumName}(\\??)`, 'g');
    content = content.replace(typeRegex, '$1String$2');
  }

  fs.writeFileSync(schemaPath, content, 'utf8');
  console.log('schema.prisma successfully adapted to SQLite compatibility.');

  // 2. Generate Prisma client & Push DB
  console.log('Generating Prisma Client for SQLite...');
  execSync(`${prismaPath} generate`, { stdio: 'inherit' });

  console.log('Pushing schema to test.db...');
  const sqliteUrl = `file:${path.resolve(__dirname, 'prisma/test.db')}`;
  process.env.DATABASE_URL = sqliteUrl;
  
  execSync(`${prismaPath} db push --accept-data-loss --force-reset`, { stdio: 'inherit' });

  // 3. Run E2E tests specifically for instagram
  console.log('Running Instagram E2E tests...');
  execSync('npx jest --config ./test/jest-e2e.json test/instagram.e2e-spec.ts', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: sqliteUrl } });

  console.log('Instagram E2E tests completed successfully!');

} catch (error) {
  console.error('Error during execution:', error.message);
  process.exitCode = 1;
} finally {
  // 4. Restore original schema
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, schemaPath);
    fs.unlinkSync(backupPath);
    console.log('schema.prisma restored.');
    try {
      execSync(`${prismaPath} generate`, { stdio: 'inherit' });
      console.log('Prisma client restored to PostgreSQL.');
    } catch (e) {
      console.error('Failed to restore Prisma client:', e.message);
    }
  }
}
