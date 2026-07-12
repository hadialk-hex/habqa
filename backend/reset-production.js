// Production reset: wipes ALL data and creates a single real super-admin account.
//   node reset-production.js <email> <password> [name] [workspaceName]
// Example:
//   node reset-production.js owner@example.com MyStr0ngPass "اسمي" "شركتي"
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const [email, password, name, workspaceName] = process.argv.slice(2);
  if (!email || !password) {
    console.error(
      'Usage: node reset-production.js <email> <password> [name] [workspaceName]',
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  console.log('Wiping all existing data...');
  await prisma.flowExecutionLog.deleteMany({});
  await prisma.flowExecution.deleteMany({});
  await prisma.flowBranch.deleteMany({});
  await prisma.flowStep.deleteMany({});
  await prisma.flowTrigger.deleteMany({});
  await prisma.flow.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.campaignRecipient.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.webhookDeduplication.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.autoReplyRule.deleteMany({});
  await prisma.platformConnection.deleteMany({});
  await prisma.tenantMember.deleteMany({});
  await prisma.customRole.deleteMany({});
  await prisma.subscriber.deleteMany({});
  await prisma.teamInvitation.deleteMany({});
  await prisma.broadcast.deleteMany({});
  await prisma.revokedToken.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});

  console.log('Creating the real super-admin account...');
  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      name: name || 'مدير المنصة',
      password: hashedPassword,
      isSuperAdmin: true,
      memberships: {
        create: {
          role: 'OWNER',
          tenant: {
            create: {
              name: workspaceName || 'مساحة عمل الإدارة',
              plan: 'ENTERPRISE',
            },
          },
        },
      },
    },
  });

  console.log('=====================================');
  console.log('Done. Platform is clean and ready.');
  console.log(`Super admin: ${email}`);
  console.log('=====================================');
}

main()
  .catch((e) => {
    console.error('Reset failed:', e.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
