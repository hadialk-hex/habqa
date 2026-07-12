const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
console.log('--- TEST PRISMA ---');
console.log('tenantMember property exists:', 'tenantMember' in prisma);
console.log('tenantMember typeof:', typeof prisma.tenantMember);
console.log('All keys:', Object.keys(prisma).filter(k => !k.startsWith('$')));
prisma.$disconnect();
