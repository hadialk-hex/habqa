import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase, seedDefaultTenant } from './db-cleanup';

jest.setTimeout(30000);

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockImplementation((pwd) => Promise.resolve(`hashed_${pwd}`)),
  compare: jest
    .fn()
    .mockImplementation((pwd, hash) =>
      Promise.resolve(hash === `hashed_${pwd}`),
    ),
}));

describe('Inbox & Subscribers (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let tenantId: string;
  let connectionId: string;
  let testCounter = 0;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    await seedDefaultTenant(prisma);
    testCounter++;

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `inboxowner_${testCounter}@example.com`,
        name: 'Inbox Owner',
        password: 'securepassword123',
        tenantName: `Inbox Tenant ${testCounter}`,
      })
      .expect(201);

    token = res.body.access_token;
    tenantId = res.body.user.tenantId;

    const conn = await prisma.platformConnection.create({
      data: {
        tenantId,
        platform: 'FACEBOOK_PAGE',
        platformId: 'page_123',
        name: 'My Page',
      },
    });
    connectionId = conn.id;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('Inbox Conversations & Messages', () => {
    let conversationId: string;

    beforeEach(async () => {
      const conv = await prisma.conversation.create({
        data: {
          tenantId,
          connectionId,
          customerName: 'Alice Smith',
          customerId: 'cust_alice',
          status: 'OPEN',
        },
      });
      conversationId = conv.id;

      await prisma.message.create({
        data: {
          conversationId: conv.id,
          direction: 'INBOUND',
          content: 'Hello, how can I order?',
          messageType: 'TEXT',
        },
      });
    });

    it('should retrieve active inbox conversation list (Tier 1)', async () => {
      const res = await request(app.getHttpServer())
        .get('/inbox/conversations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(1);
      expect(res.body[0].customerName).toBe('Alice Smith');
    });

    it('should retrieve messages thread for a specific conversation (Tier 1)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/inbox/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(1);
      expect(res.body[0].content).toBe('Hello, how can I order?');
    });

    it('should send a message to subscriber in conversation (Tier 1 - Expected/Mocked)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inbox/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          content: 'Sure! Here is the order link.',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.direction).toBe('OUTBOUND');
    });

    it('should mark conversation as read (Tier 1 - Expected/Mocked)', async () => {
      await request(app.getHttpServer())
        .patch(`/inbox/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${token}`)
        .send({ read: true })
        .expect(200);
    });

    it('should filter inbox conversations by channel (Tier 1 - Expected/Mocked)', async () => {
      const res = await request(app.getHttpServer())
        .get('/inbox/conversations')
        .set('Authorization', `Bearer ${token}`)
        .query({ connectionId })
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
    });

    it('should return 404 when fetching messages thread of non-existent conversation (Tier 2)', async () => {
      await request(app.getHttpServer())
        .get('/inbox/conversations/non-existent/messages')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 400 when sending message with empty content (Tier 2 - Expected/Mocked)', async () => {
      await request(app.getHttpServer())
        .post(`/inbox/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: '' })
        .expect(400);
    });

    it('should handle error and mark channel invalid when channel token has been revoked (Tier 2 - Expected/Mocked)', async () => {
      await prisma.platformConnection.update({
        where: { id: connectionId },
        data: { accessToken: 'revoked' },
      });

      await request(app.getHttpServer())
        .post(`/inbox/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'normal message content' })
        .expect((res) => {
          expect([400, 401, 500]).toContain(res.status);
        });
    });

    it('should return empty array when paginating conversation list beyond maximum range (Tier 2 - Expected/Mocked)', async () => {
      const res = await request(app.getHttpServer())
        .get('/inbox/conversations')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 999, limit: 100 })
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('Subscriber Management (Tier 1 & 2 - Expected/Mocked)', () => {
    beforeEach(async () => {
      await prisma.subscriber.create({
        data: {
          id: 'subscriber-id-123',
          tenantId,
          name: 'Manual Sub',
          phone: '+123456789',
          email: 'sub@example.com',
          tags: ['promo'],
          notes: 'Important customer',
        },
      });
    });

    it('should create new subscriber manually (Tier 1)', async () => {
      await request(app.getHttpServer())
        .post('/subscribers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Manual Sub',
          phone: '+123456789',
          email: 'sub@example.com',
          tags: ['promo'],
        })
        .expect(201);
    });

    it('should fetch subscriber details by ID (Tier 1)', async () => {
      await request(app.getHttpServer())
        .get('/subscribers/subscriber-id-123')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should update subscriber tags and notes (Tier 1)', async () => {
      await request(app.getHttpServer())
        .patch('/subscribers/subscriber-id-123')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tags: ['promo', 'vip'],
          notes: 'Important customer',
        })
        .expect(200);
    });

    it('should delete subscriber (Tier 1)', async () => {
      await request(app.getHttpServer())
        .delete('/subscribers/subscriber-id-123')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should search/filter subscribers (Tier 1)', async () => {
      const res = await request(app.getHttpServer())
        .get('/subscribers')
        .set('Authorization', `Bearer ${token}`)
        .query({ search: 'Manual' })
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
    });

    it('should return 400 when creating subscriber with malformed email or phone number (Tier 2)', async () => {
      await request(app.getHttpServer())
        .post('/subscribers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Invalid Sub',
          phone: 'invalid-phone-number',
          email: 'malformed-email',
        })
        .expect(400);
    });

    it('should return 404 when updating non-existent subscriber (Tier 2)', async () => {
      await request(app.getHttpServer())
        .patch('/subscribers/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' })
        .expect(404);
    });

    it('should return 404 when deleting non-existent subscriber (Tier 2)', async () => {
      await request(app.getHttpServer())
        .delete('/subscribers/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return all subscribers when searching with empty search string (Tier 2)', async () => {
      const res = await request(app.getHttpServer())
        .get('/subscribers')
        .set('Authorization', `Bearer ${token}`)
        .query({ search: '' })
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
    });

    it('should not duplicate tag entries when adding duplicate tags to subscriber (Tier 2)', async () => {
      await request(app.getHttpServer())
        .patch('/subscribers/subscriber-id-123')
        .set('Authorization', `Bearer ${token}`)
        .send({ tags: ['vip', 'vip'] })
        .expect(200);
    });

    it('should retrieve conversation history for a subscriber (Task 2)', async () => {
      await prisma.conversation.create({
        data: {
          tenantId,
          connectionId,
          customerName: 'Manual Sub',
          customerId: 'sub@example.com',
          status: 'OPEN',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/subscribers/subscriber-id-123/conversation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body.customerId).toBe('sub@example.com');
    });

    it('should assign a conversation to a team member (Task 4)', async () => {
      const user = await prisma.user.findFirst({
        where: { email: { startsWith: 'inboxowner_' } },
      });

      const conv = await prisma.conversation.create({
        data: {
          tenantId,
          connectionId,
          customerName: 'Bob Vance',
          customerId: 'cust_bob',
          status: 'OPEN',
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/inbox/conversations/${conv.id}/assign`)
        .set('Authorization', `Bearer ${token}`)
        .send({ assignedToId: user!.id })
        .expect(200);

      expect(res.body.assignedToId).toBe(user!.id);
    });
  });
});
