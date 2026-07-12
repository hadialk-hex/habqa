const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const schemaPath = path.resolve(__dirname, 'prisma/schema.prisma');
const backupPath = path.resolve(__dirname, 'prisma/schema.prisma.bak');
const prismaPath = 'node node_modules/prisma/build/index.js';

function runGenerateWithRetry() {
  const maxRetries = 5;
  for (let i = 1; i <= maxRetries; i++) {
    try {
      try {
        execSync('powershell -Command "Rename-Item -Path \'node_modules\\.prisma\\client\\query_engine-windows.dll.node\' -NewName \'query_engine-windows.dll.node.old\' -ErrorAction SilentlyContinue"');
        execSync('powershell -Command "Rename-Item -Path \'node_modules\\@prisma\\client\\query_engine-windows.dll.node\' -NewName \'query_engine-windows.dll.node.old\' -ErrorAction SilentlyContinue"');
      } catch (err) {
        // Ignore rename failures (e.g. if file doesn't exist)
      }
      execSync(`${prismaPath} generate`, { stdio: 'inherit' });
      return;
    } catch (e) {
      if (i === maxRetries) {
        throw e;
      }
      console.warn(`Prisma generate failed (attempt \${i}/\${maxRetries}), retrying in 1s due to lock:`, e.message);
      try {
        execSync('powershell -Command "Start-Sleep -s 1"');
      } catch (err) {
        const start = Date.now();
        while (Date.now() - start < 1000) {}
      }
    }
  }
}

console.log('Fixed SQLite Test Runner starting (offline mode)...');

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
  // Also replace any defaults, e.g. "plan TenantPlan @default(STARTER)" -> "plan String @default("STARTER")"
  for (const enumName of enums) {
    // Regex for: fieldName enumName @default(VALUE)
    const defaultRegex = new RegExp(`(\\b\\w+\\s+)${enumName}(\\s+@default\\()(\\w+)(\\))`, 'g');
    content = content.replace(defaultRegex, '$1String$2"$3"$4');

    // Regex for: fieldName enumName? or fieldName enumName
    const typeRegex = new RegExp(`(\\b\\w+\\s+)${enumName}(\\??)`, 'g');
    content = content.replace(typeRegex, '$1String$2');
  }

  fs.writeFileSync(schemaPath, content, 'utf8');
  console.log('schema.prisma successfully adapted to SQLite compatibility.');

  // 2. Generate Prisma client & Push DB
  console.log('Generating Prisma Client for SQLite...');
  runGenerateWithRetry();

  // Inject enums into generated client
  console.log('Injecting JS enums into Prisma client for E2E runtime compatibility...');
  const targets = [
    path.resolve(__dirname, 'node_modules/@prisma/client/index.js'),
    path.resolve(__dirname, 'node_modules/.prisma/client/index.js')
  ];
  const enumInjections = `
Object.assign(module.exports, {
  PlatformType: { FACEBOOK_PAGE: 'FACEBOOK_PAGE', INSTAGRAM: 'INSTAGRAM', WHATSAPP: 'WHATSAPP' },
  TriggerType: { KEYWORD: 'KEYWORD', ANY_COMMENT: 'ANY_COMMENT' },
  MatchType: { EXACT: 'EXACT', CONTAINS: 'CONTAINS', STARTS_WITH: 'STARTS_WITH', ENDS_WITH: 'ENDS_WITH' },
  ConversationStatus: { OPEN: 'OPEN', RESOLVED: 'RESOLVED', SNOOZED: 'SNOOZED', PENDING: 'PENDING' },
  MessageDirection: { INBOUND: 'INBOUND', OUTBOUND: 'OUTBOUND' },
  MessageType: { TEXT: 'TEXT', COMMENT: 'COMMENT', MEDIA: 'MEDIA', IMAGE: 'IMAGE', TEMPLATE: 'TEMPLATE' },
  CampaignStatus: { DRAFT: 'DRAFT', SCHEDULED: 'SCHEDULED', SENT: 'SENT', CANCELLED: 'CANCELLED' },
  TenantPlan: { STARTER: 'STARTER', PRO: 'PRO', ENTERPRISE: 'ENTERPRISE' },
  TenantRole: { OWNER: 'OWNER', ADMIN: 'ADMIN', MEMBER: 'MEMBER', AGENT: 'AGENT', VIEWER: 'VIEWER' }
});
`;
  for (const target of targets) {
    if (fs.existsSync(target)) {
      fs.appendFileSync(target, enumInjections, 'utf8');
    }
  }

  console.log('Pushing schema to test.db...');
  const sqliteUrl = `file:${path.resolve(__dirname, 'prisma/test.db')}`;
  process.env.DATABASE_URL = sqliteUrl;
  
  execSync(`${prismaPath} db push --accept-data-loss --force-reset`, { stdio: 'inherit' });

  // 3. Run E2E tests specifically for channels
  console.log('Running Channels E2E tests...');
  execSync('npx jest --config ./test/jest-e2e.json test/channels.e2e-spec.ts --forceExit', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: sqliteUrl } });

  console.log('Channels E2E tests completed successfully!');

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
      runGenerateWithRetry();
      console.log('Prisma client restored to PostgreSQL.');
    } catch (e) {
      console.error('Failed to restore Prisma client:', e.message);
    }
  }
}
