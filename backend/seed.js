const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // 1. Clean up existing records in correct order (dependency resolution)
  console.log('Cleaning up existing database records...');
  
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
  
  // Clean up user-added models referencing Tenant/User
  await prisma.subscriber.deleteMany({});
  await prisma.teamInvitation.deleteMany({});
  await prisma.broadcast.deleteMany({});
  await prisma.revokedToken.deleteMany({});

  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});

  console.log('Database cleaned. Seeding new data...');

  // 2. Seed Tenants
  const demoTenant = await prisma.tenant.create({
    data: {
      id: 'demo-tenant-id',
      name: 'Demo Tenant Enterprise',
      plan: 'ENTERPRISE',
    },
  });
  console.log(`Seeded Tenant: ${demoTenant.name}`);

  // 3. Seed Users & Hashes
  const adminPasswordHash = await bcrypt.hash('x123x123', 10);
  const agentPasswordHash = await bcrypt.hash('agentpass123', 10);

  const adminUser = await prisma.user.create({
    data: {
      id: 'user-admin-id',
      email: 'hadialk3@gmail.com',
      name: 'Admin User',
      password: adminPasswordHash,
      isSuperAdmin: true, // Platform admin — can access /admin
    },
  });

  const agentUser = await prisma.user.create({
    data: {
      id: 'user-agent-id',
      email: 'agent@neqta.com',
      name: 'Agent User',
      password: agentPasswordHash,
    },
  });
  console.log('Seeded Users (hadialk3@gmail.com, agent@neqta.com)');

  // 4. Seed Custom Roles
  const campaignManagerRole = await prisma.customRole.create({
    data: {
      id: 'role-campaign-mgr-id',
      tenantId: demoTenant.id,
      name: 'Campaign Manager',
      description: 'Manages marketing broadcasts, campaigns, and contacts',
      permissions: ['campaign:create', 'campaign:send', 'inbox:read'],
    },
  });
  console.log(`Seeded Custom Role: ${campaignManagerRole.name}`);

  // 5. Seed Tenant Memberships
  await prisma.tenantMember.create({
    data: {
      userId: adminUser.id,
      tenantId: demoTenant.id,
      role: 'OWNER', // Native Enum
    },
  });

  await prisma.tenantMember.create({
    data: {
      userId: agentUser.id,
      tenantId: demoTenant.id,
      role: 'AGENT', // Native Enum
      roleId: campaignManagerRole.id, // Custom Role relation
    },
  });
  console.log('Seeded Tenant Memberships');

  // 6. Seed Platform Connections
  const fbConnection = await prisma.platformConnection.create({
    data: {
      id: 'conn-fb-id',
      tenantId: demoTenant.id,
      platform: 'FACEBOOK_PAGE', // Native Enum
      platformId: 'fb-page-123456',
      name: 'Neqta Facebook Page',
      accessToken: 'EAAByz...',
      isActive: true,
    },
  });

  const waConnection = await prisma.platformConnection.create({
    data: {
      id: 'conn-wa-id',
      tenantId: demoTenant.id,
      platform: 'WHATSAPP', // Native Enum
      platformId: 'wa-phone-9665000000',
      name: '+966 50 000 0000',
      accessToken: 'EAAYbW...',
      isActive: true,
    },
  });
  console.log('Seeded Platform Connections (Facebook, WhatsApp)');

  // 7. Seed Auto Reply Rules
  await prisma.autoReplyRule.create({
    data: {
      tenantId: demoTenant.id,
      connectionId: fbConnection.id,
      name: 'Welcome Keyword Rule',
      triggerType: 'KEYWORD', // Native Enum
      keywords: 'مرحبا، هلا، السلام',
      matchType: 'CONTAINS', // Native Enum
      replyText: 'أهلاً بك في Neqta! كيف يمكنني مساعدتك اليوم؟',
      priority: 10,
      isActive: true,
    },
  });
  console.log('Seeded Auto Reply Rules');

  // 8. Seed Conversations & Messages
  const demoConv = await prisma.conversation.create({
    data: {
      id: 'conv-demo-id',
      tenantId: demoTenant.id,
      connectionId: fbConnection.id,
      customerName: 'John Doe',
      customerId: 'psid-customer-123',
      status: 'OPEN', // Native Enum
      lastMessageAt: new Date(Date.now() - 30 * 60000), // 30 mins ago
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: demoConv.id,
        direction: 'INBOUND',
        content: 'مرحبا',
        messageType: 'TEXT',
        createdAt: new Date(Date.now() - 60 * 60000),
      },
      {
        conversationId: demoConv.id,
        direction: 'OUTBOUND',
        content: 'أهلاً بك في Neqta! كيف يمكنني مساعدتك اليوم؟',
        messageType: 'TEXT',
        createdAt: new Date(Date.now() - 59 * 60000),
      },
      {
        conversationId: demoConv.id,
        direction: 'INBOUND',
        content: 'أريد الاستفسار عن باقات الخدمة',
        messageType: 'TEXT',
        createdAt: new Date(Date.now() - 30 * 60000),
      },
    ],
  });
  console.log('Seeded Conversations and Messages');

  // 9. Seed Password Reset Tokens
  await prisma.passwordResetToken.create({
    data: {
      userId: adminUser.id,
      token: 'secure_password_reset_token_hash_abc123',
      expiresAt: new Date(Date.now() + 60 * 60000), // Expires in 1 hour
    },
  });
  console.log('Seeded Password Reset Token');

  // 10. Seed Webhook Deduplication Entries
  await prisma.webhookDeduplication.create({
    data: {
      eventId: 'wh_evt_fb_998877',
      platform: 'FACEBOOK',
      tenantId: demoTenant.id,
      status: 'PROCESSED',
      expiresAt: new Date(Date.now() + 48 * 3600000), // Expires in 48 hours
    },
  });
  console.log('Seeded Webhook Deduplication Entry');

  // 11. Seed Campaigns (Broadcasts)
  const ramadanCampaign = await prisma.campaign.create({
    data: {
      id: 'campaign-ramadan-id',
      tenantId: demoTenant.id,
      connectionId: waConnection.id,
      name: 'Ramadan Campaign Offer',
      description: 'Ramadan greeting campaign with 20% coupon',
      status: 'SENT', // Native Enum (CampaignStatus)
      content: 'كل عام وأنتم بخير! خصم 20% بمناسبة شهر رمضان الكريم باستخدام كود RAMADAN20.',
      mediaUrl: {
        type: 'IMAGE',
        url: 'https://demo.neqta.com/media/ramadan.jpg',
      },
      scheduledAt: new Date(Date.now() - 120 * 60000),
      sentAt: new Date(Date.now() - 118 * 60000),
    },
  });

  await prisma.campaignRecipient.createMany({
    data: [
      {
        campaignId: ramadanCampaign.id,
        customerId: 'wa-recipient-1',
        customerName: 'Ahmad Al-Saeed',
        status: 'READ',
        sentAt: new Date(Date.now() - 120 * 60000),
        deliveredAt: new Date(Date.now() - 119 * 60000),
        readAt: new Date(Date.now() - 115 * 60000),
      },
      {
        campaignId: ramadanCampaign.id,
        customerId: 'wa-recipient-2',
        customerName: 'Fatima Omar',
        status: 'FAILED',
        errorMessage: 'Invalid phone number format',
        sentAt: new Date(Date.now() - 120 * 60000),
      },
    ],
  });
  console.log('Seeded Campaigns and Recipients');

  // 12. Seed Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        tenantId: demoTenant.id,
        userId: adminUser.id,
        action: 'USER_LOGIN',
        entityType: 'User',
        entityId: adminUser.id,
        newValues: { email: adminUser.email, ip: '127.0.0.1' },
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      {
        tenantId: demoTenant.id,
        userId: adminUser.id,
        action: 'CAMPAIGN_CREATED',
        entityType: 'Campaign',
        entityId: ramadanCampaign.id,
        newValues: { name: ramadanCampaign.name, connectionId: ramadanCampaign.connectionId },
        ipAddress: '127.0.0.1',
      },
    ],
  });
  console.log('Seeded Audit Logs');

  // 13. Seed Flow Automation
  const welcomeFlow = await prisma.flow.create({
    data: {
      id: 'flow-welcome-id',
      tenantId: demoTenant.id,
      name: 'Default Welcome Flow',
      description: 'Triggered when a customer types start or hello',
      isActive: true,
    },
  });

  await prisma.flowTrigger.create({
    data: {
      flowId: welcomeFlow.id,
      type: 'INCOMING_MESSAGE',
      configuration: {
        keywords: ['start', 'hello', 'بدء', 'مرحبا'],
      },
    },
  });

  const step1 = await prisma.flowStep.create({
    data: {
      id: 'flow-step-1-id',
      flowId: welcomeFlow.id,
      type: 'SEND_MESSAGE',
      configuration: {
        message: 'أهلاً بك في نظام خدمة العملاء المؤتمت! الرجاء اختيار أحد الخيارات التالية:\n1. الأسعار\n2. التحدث مع وكيل',
      },
      metadata: { x: 100, y: 100 },
    },
  });

  const stepWait = await prisma.flowStep.create({
    data: {
      id: 'flow-step-wait-id',
      flowId: welcomeFlow.id,
      type: 'WAIT_DELAY',
      configuration: {
        delaySeconds: 300, // 5 minutes
      },
      metadata: { x: 100, y: 250 },
    },
  });

  const stepAgent = await prisma.flowStep.create({
    data: {
      id: 'flow-step-agent-id',
      flowId: welcomeFlow.id,
      type: 'ASSIGN_AGENT',
      configuration: {
        message: 'جاري تحويلك إلى وكيل الدعم الفني، يرجى الانتظار...',
      },
      metadata: { x: 300, y: 400 },
    },
  });

  const stepAutoReply = await prisma.flowStep.create({
    data: {
      id: 'flow-step-autoreply-id',
      flowId: welcomeFlow.id,
      type: 'SEND_MESSAGE',
      configuration: {
        message: 'شكراً لتواصلك معنا! يمكنك زيارة موقعنا لمزيد من التفاصيل.',
      },
      metadata: { x: -100, y: 400 },
    },
  });

  // Link branches
  await prisma.flowBranch.create({
    data: {
      stepId: step1.id,
      label: 'Default Next',
      nextStepId: stepWait.id,
    },
  });

  await prisma.flowBranch.create({
    data: {
      stepId: stepWait.id,
      label: 'Option 2 (Agent)',
      condition: { option: '2' },
      nextStepId: stepAgent.id,
    },
  });

  await prisma.flowBranch.create({
    data: {
      stepId: stepWait.id,
      label: 'Timeout / Default',
      condition: { timeout: true },
      nextStepId: stepAutoReply.id,
    },
  });

  // 14. Seed Flow Executions (Running instances)
  const execution = await prisma.flowExecution.create({
    data: {
      flowId: welcomeFlow.id,
      tenantId: demoTenant.id,
      customerId: 'wa-recipient-1',
      status: 'PAUSED',
      currentStepId: stepWait.id,
      variables: { selectedOption: null },
      pausedUntil: new Date(Date.now() + 5 * 60000), // Resume in 5 mins
    },
  });

  await prisma.flowExecutionLog.create({
    data: {
      executionId: execution.id,
      stepId: step1.id,
      stepType: step1.type,
      status: 'SUCCESS',
    },
  });

  // 15. Seed User-added model data
  const demoSubscriber = await prisma.subscriber.create({
    data: {
      tenantId: demoTenant.id,
      name: 'Alice Smith',
      phone: '+966 50 111 2222',
      email: 'alice@example.com',
      tags: ['vip', 'newsletter'],
      notes: 'Interested in enterprise plan features',
    },
  });
  console.log(`Seeded Subscriber: ${demoSubscriber.name}`);

  const demoInvitation = await prisma.teamInvitation.create({
    data: {
      tenantId: demoTenant.id,
      email: 'new_member@neqta.com',
      role: 'MEMBER',
      token: 'invitation_token_xyz_789',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });
  console.log(`Seeded TeamInvitation to: ${demoInvitation.email}`);

  const demoBroadcast = await prisma.broadcast.create({
    data: {
      tenantId: demoTenant.id,
      name: 'Product Launch Update',
      content: 'We are excited to launch our new product features today!',
      segmentTarget: 'vip',
      status: 'SENT',
      sentCount: 1,
      deliveredCount: 1,
    },
  });
  console.log(`Seeded Broadcast: ${demoBroadcast.name}`);

  const demoRevokedToken = await prisma.revokedToken.create({
    data: {
      token: 'revoked_jwt_token_sample_value_123',
    },
  });
  console.log('Seeded RevokedToken');

  console.log('Seeded Flow Automation structures and logs successfully');
  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
