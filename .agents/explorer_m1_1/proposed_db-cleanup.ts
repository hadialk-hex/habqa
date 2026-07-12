import { PrismaClient } from '@prisma/client';

/**
 * Cleans all tables in the database to ensure test isolation.
 * Supports both SQLite and PostgreSQL.
 */
export async function cleanDatabase(prisma: PrismaClient) {
  const isPostgres = process.env.DATABASE_URL?.startsWith('postgresql://');

  const tables = [
    'Message',
    'Conversation',
    'AutoReplyRule',
    'PlatformConnection',
    'TenantMember',
    'Tenant',
    'User',
  ];

  if (isPostgres) {
    // PostgreSQL Native Truncation
    const tableNamesList = tables.map((t) => `"${t}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNamesList} RESTART IDENTITY CASCADE;`);
  } else {
    // SQLite Foreign Key Bypass & Deletion
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');
    try {
      for (const table of tables) {
        await prisma.$executeRawUnsafe(`DELETE FROM "${table}";`);
      }
    } finally {
      await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
    }
  }
}

/**
 * Seeds default required system data for E2E tests (e.g. demo tenant).
 */
export async function seedDefaultTenant(prisma: PrismaClient) {
  return prisma.tenant.upsert({
    where: { id: 'demo-tenant-id' },
    update: {},
    create: {
      id: 'demo-tenant-id',
      name: 'Demo Tenant',
      plan: 'ENTERPRISE',
    },
  });
}
