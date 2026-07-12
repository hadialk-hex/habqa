const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgrespassword@127.0.0.1:5433/hubqa_test?schema=public'
    }
  }
});

async function main() {
  const oids = [33810, 33756, 33710];
  const results = await prisma.$queryRaw`
    SELECT oid, relname FROM pg_class WHERE oid = ANY(${oids}::oid[])
  `;
  console.log('Results:', results);
  await prisma.$disconnect();
}

main().catch(console.error);
