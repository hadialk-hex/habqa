import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase, seedDefaultTenant } from './db-cleanup';
import * as crypto from 'crypto';

jest.setTimeout(30000);

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockImplementation((pwd) => Promise.resolve(`hashed_${pwd}`)),
  compare: jest
    .fn()
    .mockImplementation((pwd, hash) =>
      Promise.resolve(hash === `hashed_${pwd}`),
    ),
}));

describe('Instagram Webhook & Rules (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenantId = 'demo-tenant-id';

  beforeAll(async () => {
    process.env.WEBHOOK_VERIFY_TOKEN = 'hubqa_secure_verify_token_2026';
    process.env.APP_SECRET = 'facebook-app-secret-key';
    process.env.ENCRYPTION_KEY = 'super-secret-encryption-key-32ch-long-here';

    // Mock global fetch to prevent external Graph API calls
    jest.spyOn(global, 'fetch').mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      } as any);
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    await seedDefaultTenant(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  function sendWebhookWithSignature(payload: any) {
    const payloadString = JSON.stringify(payload);
    const secret = process.env.APP_SECRET || 'facebook-app-secret-key';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');

    return request(app.getHttpServer())
      .post('/webhooks')
      .set('x-hub-signature-256', `sha256=${signature}`)
      .set('Content-Type', 'application/json')
      .send(payloadString);
  }

  it('should process Instagram comment webhook and trigger rule execution with correct platform check', async () => {
    // 1. Create Instagram platform connection
    const connection = await prisma.platformConnection.create({
      data: {
        tenantId,
        platform: 'INSTAGRAM',
        platformId: 'ig_account_123',
        name: 'My IG Business Account',
        accessToken: 'super-secret-encryption-key-32ch-long-here:token', // dummy encrypted token format
      },
    });

    // 2. Configure a rule for Instagram (or global rule)
    const rule = await prisma.autoReplyRule.create({
      data: {
        tenantId,
        connectionId: connection.id,
        name: 'IG Promo Rule',
        triggerType: 'KEYWORD',
        keywords: 'discount, code',
        replyText: 'Check your DM for the code!',
        privateText: 'Here is your code: IGCODE100',
      },
    });

    // 3. Trigger Instagram comment webhook event
    const igPayload = {
      object: 'instagram',
      entry: [
        {
          id: 'ig_account_123',
          time: 1445431427,
          changes: [
            {
              field: 'comments',
              value: {
                id: 'ig_comment_999',
                text: 'Can I get a discount code?',
                from: {
                  id: 'ig_user_456',
                  username: 'ig_buyer',
                },
                media: {
                  id: 'ig_media_777',
                  media_product_type: 'FEED',
                },
              },
            },
          ],
        },
      ],
    };

    await sendWebhookWithSignature(igPayload).expect(200);

    // 4. Verify subscriber / conversation thread creation
    const conversation = await prisma.conversation.findFirst({
      where: {
        connectionId: connection.id,
        customerId: 'ig_user_456',
      },
      include: {
        messages: true,
      },
    });

    expect(conversation).not.toBeNull();
    expect(conversation!.customerName).toBe('Customer'); // fallback name for IG

    // 5. Verify database messages (1 inbound comment, 1 outbound public comment reply, 1 outbound private DM)
    const messages = conversation!.messages;
    expect(messages.length).toBe(3);

    const inbound = messages.find((m) => m.direction === 'INBOUND');
    expect(inbound).toBeDefined();
    expect(inbound!.content).toBe('Can I get a discount code?');
    expect(inbound!.messageType).toBe('COMMENT');

    const outboundReplies = messages.filter((m) => m.direction === 'OUTBOUND');
    expect(outboundReplies.length).toBe(2);

    const publicReply = outboundReplies.find(
      (m) => m.messageType === 'COMMENT',
    );
    expect(publicReply).toBeDefined();
    expect(publicReply!.content).toBe('Check your DM for the code!');

    const privateDm = outboundReplies.find((m) => m.messageType === 'TEXT');
    expect(privateDm).toBeDefined();
    expect(privateDm!.content).toBe('Here is your code: IGCODE100');

    // 6. Verify audit log entry
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entityId: rule.id,
        action: 'RULE_TRIGGERED',
      },
    });
    expect(auditLog).not.toBeNull();
  });

  it('should not match Facebook rules for Instagram comments', async () => {
    // 1. Create Instagram and Facebook platform connections
    const fbConnection = await prisma.platformConnection.create({
      data: {
        tenantId,
        platform: 'FACEBOOK_PAGE',
        platformId: 'fb_page_123',
        name: 'My FB Page',
      },
    });

    const igConnection = await prisma.platformConnection.create({
      data: {
        tenantId,
        platform: 'INSTAGRAM',
        platformId: 'ig_account_123',
        name: 'My IG Business Account',
      },
    });

    // 2. Configure a rule scoped specifically to the Facebook connection
    await prisma.autoReplyRule.create({
      data: {
        tenantId,
        connectionId: fbConnection.id,
        name: 'FB Only Promo',
        triggerType: 'KEYWORD',
        keywords: 'discount',
        replyText: 'FB Reply!',
      },
    });

    // 3. Trigger Instagram comment webhook event with matching keyword
    const igPayload = {
      object: 'instagram',
      entry: [
        {
          id: 'ig_account_123',
          time: 1445431427,
          changes: [
            {
              field: 'comments',
              value: {
                id: 'ig_comment_999',
                text: 'Can I get a discount code?',
                from: {
                  id: 'ig_user_456',
                  username: 'ig_buyer',
                },
                media: {
                  id: 'ig_media_777',
                },
              },
            },
          ],
        },
      ],
    };

    await sendWebhookWithSignature(igPayload).expect(200);

    // 4. Verify conversation is created, but no rule execution (only inbound message, no outbound messages)
    const conversation = await prisma.conversation.findFirst({
      where: {
        connectionId: igConnection.id,
        customerId: 'ig_user_456',
      },
      include: {
        messages: true,
      },
    });

    expect(conversation).not.toBeNull();
    const outboundReplies = conversation!.messages.filter(
      (m) => m.direction === 'OUTBOUND',
    );
    expect(outboundReplies.length).toBe(0); // FB rule not matched
  });
});
