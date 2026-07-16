import { PrismaClient } from '@prisma/client';

/**
 * Cleans all tables in the database to ensure test isolation.
 * Supports both SQLite and PostgreSQL.
 */
export async function cleanDatabase(prisma: PrismaClient) {
  const models = [
    'webhookDeduplication',
    'passwordResetToken',
    'revokedToken',
    'subscriber',
    'teamInvitation',
    'message',
    'conversation',
    'broadcast',
    'autoReplyRule',
    'platformConnection',
    'tenantMember',
    'tenant',
    'user',
  ];

  let retries = 5;
  while (retries > 0) {
    try {
      const client = prisma as unknown as Record<
        string,
        { deleteMany: () => Promise<any> }
      >;
      for (const model of models) {
        if (client[model] && typeof client[model].deleteMany === 'function') {
          await client[model].deleteMany();
        }
      }
      break; // Success
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      if (
        err.message?.includes('database is locked') ||
        err.message?.includes('deadlock') ||
        err.code === '5' ||
        err.code === '40P01'
      ) {
        retries--;
        if (retries === 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, 200));
      } else {
        throw error;
      }
    }
  }
}

/**
 * Seeds default required system data for E2E tests (e.g. demo tenant).
 */
export async function seedDefaultTenant(prisma: PrismaClient) {
  try {
    const existing = await prisma.tenant.findUnique({
      where: { id: 'demo-tenant-id' },
    });
    if (existing) {
      return existing;
    }
  } catch {
    // Ignore and try creating
  }

  try {
    const tenant = await prisma.tenant.create({
      data: {
        id: 'demo-tenant-id',
        name: 'Demo Tenant',
        plan: 'ENTERPRISE',
      },
    });
    return tenant;
  } catch (error: any) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: 'demo-tenant-id' },
    });
    if (tenant) return tenant;
    throw error;
  }
}
