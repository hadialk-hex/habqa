process.env.NODE_ENV = 'test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';

// Load environment variables from the backend root .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import * as fs from 'fs';

// Read schema.prisma dynamically to detect the provider
const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

// Simple search for provider in datasource
const datasourceMatch = schemaContent.match(/datasource\s+db\s*\{([^}]+)\}/);
let provider = 'sqlite';
if (datasourceMatch) {
  const providerMatch = datasourceMatch[1].match(/provider\s*=\s*"([^"]+)"/);
  if (providerMatch) {
    provider = providerMatch[1].trim().toLowerCase();
  }
}

console.log(`[E2E Setup] Detected Prisma provider: ${provider}`);

const resolvedUrlPath = path.resolve(__dirname, './.resolved_db_url');
let databaseUrl = '';
if (fs.existsSync(resolvedUrlPath)) {
  databaseUrl = fs.readFileSync(resolvedUrlPath, 'utf8').trim();
}

const workerId = process.env.JEST_WORKER_ID || '1';

if (provider === 'postgresql') {
  let resolvedUrl = databaseUrl;
  if (!resolvedUrl || resolvedUrl.startsWith('file:')) {
    resolvedUrl =
      process.env.TEST_DATABASE_URL ||
      process.env.DATABASE_URL ||
      'postgresql://postgres:password@127.0.0.1:5433/hubqa_test?schema=public';
  }
  // Inject schema parameter for worker isolation
  if (resolvedUrl.includes('schema=')) {
    resolvedUrl = resolvedUrl.replace(
      /schema=[^&]+/g,
      `schema=worker_${workerId}`,
    );
  } else {
    const separator = resolvedUrl.includes('?') ? '&' : '?';
    resolvedUrl = `${resolvedUrl}${separator}schema=worker_${workerId}`;
  }
  process.env.DATABASE_URL = resolvedUrl;
  console.log(
    `[E2E Setup] Using PostgreSQL isolated database for worker ${workerId}: ${process.env.DATABASE_URL}`,
  );

  // Sync the schema for this worker's isolated schema
  try {
    execSync('npx prisma db push --accept-data-loss --skip-generate', {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: 'ignore',
      timeout: 15000,
    });
  } catch (err: any) {
    console.error(`Failed to push schema for worker ${workerId}:`, err.message);
  }
} else {
  const sqliteTestDbPath = path.resolve(__dirname, '../prisma/test.db');
  const workerDbPath = path.resolve(__dirname, `../prisma/test_${workerId}.db`);
  try {
    if (fs.existsSync(sqliteTestDbPath)) {
      if (fs.existsSync(workerDbPath)) {
        fs.unlinkSync(workerDbPath);
      }
      fs.copyFileSync(sqliteTestDbPath, workerDbPath);
    }
  } catch (err) {
    console.error(
      `Failed to copy isolated database for worker ${workerId}:`,
      err,
    );
  }
  process.env.DATABASE_URL = `file:${workerDbPath}?connection_limit=10`;
  console.log(
    `[E2E Setup] Using SQLite isolated database for worker ${workerId}: ${process.env.DATABASE_URL}`,
  );
}

// Mock Redis for E2E tests when local Redis is not running
jest.mock('ioredis', () => {
  const EventEmitter = require('events');
  class MockRedis extends EventEmitter {
    constructor() {
      super();
      process.nextTick(() => {
        this.emit('connect');
        this.emit('ready');
      });
    }
    options = {};
    status = 'ready';
    on = jest.fn().mockImplementation(function (this: any, event, cb) {
      if (event === 'connect' || event === 'ready') {
        process.nextTick(() => cb());
      }
      return this;
    });
    info = jest.fn().mockResolvedValue('redis_version:7.0.0');
    multi = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });
    get = jest.fn().mockResolvedValue(null);
    set = jest.fn().mockResolvedValue('OK');
    del = jest.fn().mockResolvedValue(1);
    quit = jest.fn().mockResolvedValue('OK');
    disconnect = jest.fn();
  }
  return MockRedis;
});

jest.mock('cache-manager-redis-yet', () => {
  return {
    redisStore: jest.fn().mockImplementation(async () => {
      const map = new Map();
      return {
        name: 'memory',
        set: async (key: any, val: any) => {
          map.set(key, val);
        },
        get: async (key: any) => map.get(key),
        del: async (key: any) => {
          map.delete(key);
        },
        clear: async () => {
          map.clear();
        },
      };
    }),
  };
});
