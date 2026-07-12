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
    try {
      await this.$executeRawUnsafe('PRAGMA journal_mode = WAL;');
      await this.$executeRawUnsafe('PRAGMA busy_timeout = 10000;');
    } catch (e) {
      // ignore if database URL is not sqlite or provider doesn't support it
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
