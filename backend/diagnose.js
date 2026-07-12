const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('--- DIAGNOSTIC SCRIPT ---');
  try {
    const tenants = await prisma.tenant.findMany();
    console.log('Tenants:', tenants);

    const connections = await prisma.platformConnection.findMany();
    console.log('PlatformConnections:', connections);

    if (connections.length > 0) {
      const conn = connections[0];
      console.log('Attempting to create conversation with:', {
        tenantId: conn.tenantId,
        connectionId: conn.id,
        customerId: 'test_cust',
        customerName: 'Test Cust',
        status: 'OPEN',
      });
      const conv = await prisma.conversation.create({
        data: {
          tenantId: conn.tenantId,
          connectionId: conn.id,
          customerId: 'test_cust',
          customerName: 'Test Cust',
          status: 'OPEN',
        }
      });
      console.log('Conversation created successfully:', conv);
    } else {
      console.log('No platform connections found in DB.');
    }
  } catch (error) {
    console.error('Error during diagnostics:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
