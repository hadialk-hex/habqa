process.env.NODE_ENV = 'e2e';
import { execSync } from 'child_process';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as net from 'net';

export default async () => {
  await Promise.resolve();
  console.log('\n=============================================');
  console.log('Starting E2E Global Setup...');

  // 1. Load environment variables
  dotenv.config({ path: path.resolve(__dirname, '../.env') });

  // 2. Read schema.prisma dynamically to detect the provider
  const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
  console.log(`[E2E Debug] Reading schema from: ${schemaPath}`);
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  console.log(`[E2E Debug] Schema snippet: ${schemaContent.substring(0, 150)}`);

  const datasourceMatch = schemaContent.match(/datasource\s+db\s*\{([^}]+)\}/);
  let provider = 'sqlite';
  if (datasourceMatch) {
    const providerMatch = datasourceMatch[1].match(/provider\s*=\s*"([^"]+)"/);
    if (providerMatch) {
      provider = providerMatch[1].trim().toLowerCase();
    }
  }

  console.log(`[E2E Global Setup] Detected Prisma provider: ${provider}`);

  let databaseUrl = '';
  if (provider === 'postgresql') {
    const testUrl = process.env.TEST_DATABASE_URL;
    let useFallback = true;
    if (testUrl) {
      try {
        const parsedUrl = new URL(testUrl.replace('postgresql://', 'http://'));
        const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 5432;
        const host = parsedUrl.hostname || 'localhost';

        const isReachable = await new Promise<boolean>((resolve) => {
          const socket = new net.Socket();
          socket.setTimeout(5000);
          socket.on('connect', () => {
            socket.destroy();
            resolve(true);
          });
          socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
          });
          socket.on('error', () => {
            socket.destroy();
            resolve(false);
          });
          socket.connect(port, host);
        });

        if (isReachable) {
          console.log(
            `[E2E Global Setup] TEST_DATABASE_URL is reachable on ${host}:${port}. Using it.`,
          );
          databaseUrl = testUrl;
          useFallback = false;
        } else {
          console.log(
            `[E2E Global Setup] TEST_DATABASE_URL on ${host}:${port} is NOT reachable. Falling back to port 5432.`,
          );
        }
      } catch (err) {
        console.warn(
          `[E2E Global Setup] Failed to parse TEST_DATABASE_URL:`,
          err,
        );
      }
    }
    if (useFallback) {
      databaseUrl =
        'postgresql://postgres:postgrespassword@127.0.0.1:5433/hubqa_test?schema=public';
      console.log(
        `[E2E Global Setup] Using PostgreSQL default fallback: ${databaseUrl}`,
      );
    }
    process.env.DATABASE_URL = databaseUrl;
    fs.writeFileSync(
      path.resolve(__dirname, './.resolved_db_url'),
      databaseUrl,
      'utf8',
    );
  } else {
    const sqliteTestDbPath = path.resolve(__dirname, '../prisma/test.db');
    databaseUrl = `file:${sqliteTestDbPath}?connection_limit=10`;
    process.env.DATABASE_URL = databaseUrl;
    fs.writeFileSync(
      path.resolve(__dirname, './.resolved_db_url'),
      databaseUrl,
      'utf8',
    );
  }

  // 3. Push schema to the test database
  console.log(`Syncing schema to E2E test database: ${databaseUrl}`);
  try {
    if (provider === 'postgresql') {
      console.log(
        'Programmatically ensuring PostgreSQL container is started...',
      );
      try {
        console.log(
          '[E2E Global Setup] Cleaning up any conflicting postgres containers...',
        );
        // execSync('docker rm -f hubqa_postgres', { stdio: 'ignore' });
        // execSync('docker rm -f hubqa-postgres', { stdio: 'ignore' });
      } catch (e) {
        // Ignore removal errors
      }
      try {
        console.log(
          '[E2E Global Setup] Cleaning up any conflicting redis containers...',
        );
        // execSync('docker rm -f hubqa_redis', { stdio: 'ignore' });
        // execSync('docker rm -f hubqa-redis', { stdio: 'ignore' });
      } catch (e) {
        // Ignore removal errors
      }
      try {
        execSync('docker compose up -d postgres', { stdio: 'inherit' });
        console.log('Waiting for PostgreSQL container to become ready...');
        let retries = 40;
        let isHealthy = false;
        while (retries > 0) {
          try {
            const status = execSync(
              'docker exec hubqa-postgres pg_isready -U postgres',
              { encoding: 'utf8' }
            );
            if (status.includes('accepting connections')) {
              console.log('PostgreSQL container is ready and accepting connections!');
              isHealthy = true;
              break;
            }
          } catch (e) {
            // Ignore exec errors
          }
          {
            const start = Date.now();
            while (Date.now() - start < 2000) {}
          }
          retries--;
        }
        if (!isHealthy) {
          console.warn(
            'Warning: PostgreSQL container did not report ready. Proceeding anyway...',
          );
        }
      } catch (err) {
        console.warn('Warning: Programmatic container start returned: ', err);
      }
      try {
        console.log('Programmatically ensuring Redis container is started...');
        execSync(
          'docker run -d --name hubqa_redis -p 6379:6379 redis:7-alpine',
          { stdio: 'inherit' },
        );
        console.log('Redis container started successfully.');
      } catch (err) {
        console.warn('Warning: Programmatic Redis start returned: ', err);
      }
    }

    console.log('Skipping Prisma Client generation in E2E setup (pre-generated)...');
    try {
      /*
      execSync('npx prisma generate', {
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'inherit',
      });
      */
      if (provider === 'sqlite') {
        console.log('[E2E Setup] Injecting JS enums into Prisma client for SQLite compatibility...');
        const clientIndexPaths = [
          path.resolve(__dirname, '../node_modules/@prisma/client/index.js'),
          path.resolve(__dirname, '../node_modules/.prisma/client/index.js')
        ];
        const enumInjections = `
Object.assign(module.exports, {
  PlatformType: { FACEBOOK_PAGE: 'FACEBOOK_PAGE', INSTAGRAM: 'INSTAGRAM', WHATSAPP: 'WHATSAPP' },
  TriggerType: { KEYWORD: 'KEYWORD', ANY_COMMENT: 'ANY_COMMENT' },
  MatchType: { EXACT: 'EXACT', CONTAINS: 'CONTAINS', STARTS_WITH: 'STARTS_WITH', ENDS_WITH: 'ENDS_WITH' },
  ConversationStatus: { OPEN: 'OPEN', RESOLVED: 'RESOLVED', SNOOZED: 'SNOOZED', PENDING: 'PENDING' },
  MessageDirection: { INBOUND: 'INBOUND', OUTBOUND: 'OUTBOUND' },
  MessageType: { TEXT: 'TEXT', COMMENT: 'COMMENT', MEDIA: 'MEDIA', IMAGE: 'IMAGE', TEMPLATE: 'TEMPLATE' },
  CampaignStatus: { DRAFT: 'DRAFT', SCHEDULED: 'SCHEDULED', SENDING: 'SENDING', SENT: 'SENT', CANCELLED: 'CANCELLED' },
  TenantPlan: { STARTER: 'STARTER', PRO: 'PRO', ENTERPRISE: 'ENTERPRISE' },
  TenantRole: { OWNER: 'OWNER', ADMIN: 'ADMIN', MEMBER: 'MEMBER', AGENT: 'AGENT', VIEWER: 'VIEWER' }
});
`;
        for (const target of clientIndexPaths) {
          if (fs.existsSync(target)) {
            fs.appendFileSync(target, enumInjections, 'utf8');
          }
        }
      }
    } catch (e: any) {
      console.warn('Skipping npx prisma generate due to error: ', e.message);
    }
    execSync('npx prisma db push --accept-data-loss --skip-generate', {
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
