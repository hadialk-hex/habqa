// Promote a user to platform super admin:
//   node make-admin.js user@example.com
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node make-admin.js <email>');
    process.exit(1);
  }

  const user = await prisma.user.update({
    where: { email },
    data: { isSuperAdmin: true },
  });

  console.log(`User ${user.email} is now a super admin.`);
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
