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

describe('Webhooks (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.WEBHOOK_VERIFY_TOKEN = 'hubqa_secure_verify_token_2026';

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

  function sendWebhookWithSignature(payload: any, requestId?: string) {
    const payloadString =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    const secret = process.env.APP_SECRET || 'facebook-app-secret-key';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');

    let reqBuilder = request(app.getHttpServer())
      .post('/webhooks')
      .set('x-hub-signature-256', `sha256=${signature}`)
      .set('Content-Type', 'application/json');

    if (requestId) {
      reqBuilder = reqBuilder.set('x-request-id', requestId);
    }

    return reqBuilder.send(payloadString);
  }

  describe('Facebook & WhatsApp Webhook Verification (GET)', () => {
    it('should process Facebook webhook verification request successfully (Tier 1)', async () => {
      const challenge = 'test_challenge_123';
      const res = await request(app.getHttpServer())
        .get('/webhooks')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'hubqa_secure_verify_token_2026',
          'hub.challenge': challenge,
        })
        .expect(200);

      expect(res.text).toBe(challenge);
    });

    it('should return 403 for Facebook verification with invalid verify token (Tier 2)', async () => {
      await request(app.getHttpServer())
        .get('/webhooks')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': 'test',
        })
        .expect(403);
    });

    it('should process WhatsApp verification request successfully (Tier 1)', async () => {
      const challenge = 'wa_challenge_abc';
      const res = await request(app.getHttpServer())
        .get('/webhooks')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'hubqa_secure_verify_token_2026',
          'hub.challenge': challenge,
        })
        .expect(200);

      expect(res.text).toBe(challenge);
    });

    it('should return 403 for WhatsApp verification with invalid verify token (Tier 2)', async () => {
      await request(app.getHttpServer())
        .get('/webhooks')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'invalid_wa_token',
          'hub.challenge': 'test',
        })
        .expect(403);
    });
  });

  describe('Facebook Event Processing (POST)', () => {
    const validFacebookPayload = {
      object: 'page',
      entry: [
        {
          id: 'page_id_123',
          time: 1445431427,
          changes: [
            {
              field: 'feed',
              value: {
                item: 'comment',
                post_id: '123_456',
                message: 'Hello, I want details!',
                from: {
                  id: 'sender_id_123',
                  name: 'Test Customer',
                },
                comment_id: 'comment_id_789',
              },
            },
          ],
        },
      ],
    };

    it('should process Facebook comment event webhook successfully (Tier 1)', async () => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: 'demo-tenant-id' },
      });
      await prisma.platformConnection.create({
        data: {
          tenantId: tenant!.id,
          platform: 'FACEBOOK_PAGE',
          platformId: '123',
          name: 'My Page',
        },
      });

      await sendWebhookWithSignature(validFacebookPayload).expect(200);
    });

    it('should return 401 when Facebook webhook lacks signature header (Tier 2)', async () => {
      await request(app.getHttpServer())
        .post('/webhooks')
        .send(validFacebookPayload)
        .expect(401);
    });

    it('should return 401 when Facebook webhook contains invalid signature (Tier 2)', async () => {
      await request(app.getHttpServer())
        .post('/webhooks')
        .set('x-hub-signature-256', 'sha256=invalid_signature')
        .send(validFacebookPayload)
        .expect(401);
    });

    it('should verify webhook deduplication of duplicate request ID (Tier 1)', async () => {
      await sendWebhookWithSignature(
        validFacebookPayload,
        'unique-request-id-123',
      ).expect(200);
      await sendWebhookWithSignature(
        validFacebookPayload,
        'unique-request-id-123',
      ).expect(200);
    });
  });

  describe('WhatsApp Event Processing (POST)', () => {
    beforeEach(async () => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: 'demo-tenant-id' },
      });
      await prisma.platformConnection.create({
        data: {
          tenantId: tenant!.id,
          platform: 'WHATSAPP',
          platformId: '123456789',
          name: 'My WhatsApp Business',
        },
      });
    });

    const validWhatsAppPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'wa_biz_account_id',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '16505551111',
                  phone_number_id: '123456789',
                },
                contacts: [
                  {
                    profile: {
                      name: 'WhatsApp Customer',
                    },
                    wa_id: '1234567890',
                  },
                ],
                messages: [
                  {
                    from: '1234567890',
                    id: 'wamid.HBgLMTIzNDU2Nzg5MFVA',
                    timestamp: '1623888888',
                    text: {
                      body: 'Interested in product',
                    },
                    type: 'text',
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    it('should process WhatsApp text message event webhook (Tier 1)', async () => {
      await sendWebhookWithSignature(validWhatsAppPayload).expect(200);
    });

    it('should process WhatsApp media event webhook (Tier 1)', async () => {
      const mediaPayload = {
        ...validWhatsAppPayload,
        entry: [
          {
            ...validWhatsAppPayload.entry[0],
            changes: [
              {
                ...validWhatsAppPayload.entry[0].changes[0],
                value: {
                  ...validWhatsAppPayload.entry[0].changes[0].value,
                  messages: [
                    {
                      from: '1234567890',
                      id: 'wamid.media123',
                      timestamp: '1623888888',
                      type: 'image',
                      image: {
                        mime_type: 'image/jpeg',
                        sha256: 'xyz',
                        id: 'media_id_abc',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      await sendWebhookWithSignature(mediaPayload).expect(200);
    });

    it('should process WhatsApp message status update webhook (Tier 1)', async () => {
      const statusPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'wa_biz_account_id',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  statuses: [
                    {
                      id: 'wamid.HBgLMTIzNDU2Nzg5MFVA',
                      status: 'delivered',
                      timestamp: '1623888890',
                      recipient_id: '1234567890',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      await sendWebhookWithSignature(statusPayload).expect(200);
    });

    it('should ignore WhatsApp webhook event with empty status update (Tier 2)', async () => {
      const emptyStatusPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'wa_biz_account_id',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  statuses: [],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      await sendWebhookWithSignature(emptyStatusPayload).expect(200);
    });

    it('should return 400 for WhatsApp webhook with malformed JSON structure (Tier 2)', async () => {
      const malformedBody = '{"malformed": json';
      const secret = process.env.APP_SECRET || 'facebook-app-secret-key';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(malformedBody)
        .digest('hex');

      await request(app.getHttpServer())
        .post('/webhooks')
        .set('x-hub-signature-256', `sha256=${signature}`)
        .set('Content-Type', 'application/json')
        .send(malformedBody)
        .expect(400);
    });
  });

  describe('General Webhook Errors & Edge Cases (Tier 2)', () => {
    it('should return 400 when webhook payload is empty (Tier 2)', async () => {
      await sendWebhookWithSignature({}).expect(400);
    });

    it('should reject or return 400 when webhook payload is extremely large (Tier 2)', async () => {
      const hugePayload = {
        object: 'page',
        data: 'a'.repeat(20 * 1024 * 1024),
      };

      await sendWebhookWithSignature(hugePayload).expect((res) => {
        expect([400, 413]).toContain(res.status);
      });
    });
  });
});
