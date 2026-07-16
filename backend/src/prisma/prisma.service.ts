import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      datasources: process.env.DATABASE_URL
        ? {
            db: {
              url: process.env.DATABASE_URL,
            },
          }
        : undefined,
    });
  }

  async onModuleInit() {
    await this.$connect();

    const databaseUrl = process.env.DATABASE_URL ?? '';
    const isSqlite =
      databaseUrl.startsWith('file:') ||
      databaseUrl.startsWith('sqlite:') ||
      databaseUrl.includes('mode=memory');

    if (!isSqlite) {
      return;
    }

    try {
      await this.$executeRawUnsafe('PRAGMA journal_mode = WAL;');
      await this.$executeRawUnsafe('PRAGMA busy_timeout = 10000;');
    } catch {
      // Ignore SQLite-specific tuning failures when the DB is not SQLite.
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
