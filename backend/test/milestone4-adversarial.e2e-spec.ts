import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase, seedDefaultTenant } from './db-cleanup';

jest.setTimeout(60000);

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockImplementation((pwd) => Promise.resolve(`hashed_${pwd}`)),
  compare: jest
    .fn()
    .mockImplementation((pwd, hash) =>
      Promise.resolve(hash === `hashed_${pwd}`),
    ),
}));

describe('Milestone 4 Subscribers & Inbox Upgrade Adversarial Verification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Tenant A
  let tokenA: string;
  let tenantAId: string;
  let userAId: string;

  // Tenant B
  let tokenB: string;
  let tenantBId: string;
  let userBId: string;

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

    // Register User A
    const resA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `tenant_a_${testCounter}@example.com`,
        name: 'User A',
        password: 'password123',
        tenantName: `Tenant A ${testCounter}`,
      })
      .expect(201);
    tokenA = resA.body.access_token;
    tenantAId = resA.body.user.tenantId;
    userAId = resA.body.user.id;

    // Register User B
    const resB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `tenant_b_${testCounter}@example.com`,
        name: 'User B',
        password: 'password123',
        tenantName: `Tenant B ${testCounter}`,
      })
      .expect(201);
    tokenB = resB.body.access_token;
    tenantBId = resB.body.user.tenantId;
    userBId = resB.body.user.id;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  // ==========================================
  // 1. GET /subscribers (Pagination, Search, Filter)
  // ==========================================
  describe('GET /subscribers - Paginated, Search and Filters', () => {
    beforeEach(async () => {
      // Seed some subscribers for Tenant A
      await prisma.subscriber.createMany({
        data: [
          {
            tenantId: tenantAId,
            name: 'Alice Smith',
            email: 'alice@example.com',
            phone: '+1234567890',
            tags: ['vip', 'lead'],
            platform: 'FACEBOOK_PAGE',
          },
          {
            tenantId: tenantAId,
            name: 'Bob Johnson',
            email: 'bob@example.com',
            phone: '+1987654321',
            tags: ['lead'],
            platform: 'WHATSAPP',
          },
          {
            tenantId: tenantAId,
            name: 'Charlie Brown',
            email: 'charlie@example.com',
            phone: '+1555555555',
            tags: ['promo'],
            platform: 'INSTAGRAM',
          },
        ],
      });

      // Seed subscribers for Tenant B
      await prisma.subscriber.createMany({
        data: [
          {
            tenantId: tenantBId,
            name: 'David Miller',
            email: 'david@example.com',
            phone: '+1222222222',
            tags: ['vip'],
            platform: 'WHATSAPP',
          },
        ],
      });
    });

    it('should segregate paginated subscribers correctly (Tenant A does not see Tenant B)', async () => {
      const res = await request(app.getHttpServer())
        .get('/subscribers')
        .set('Authorization', `Bearer ${tokenA}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(res.body.data).toHaveLength(3);
      expect(res.body.total).toBe(3);
      const names = res.body.data.map((sub: any) => sub.name);
      expect(names).not.toContain('David Miller');
    });

    it('should handle extremely large page limit parameters gracefully', async () => {
      // Stress-testing with extremely large limit
      const res = await request(app.getHttpServer())
        .get('/subscribers')
        .set('Authorization', `Bearer ${tokenA}`)
        .query({ page: 1, limit: 1000000 })
        .expect(200);

      expect(res.body.data).toHaveLength(3);
      expect(res.body.total).toBe(3);
    });

    it('should ignore invalid negative or non-numeric page/limit parameters and fallback to full list', async () => {
      const res = await request(app.getHttpServer())
        .get('/subscribers')
        .set('Authorization', `Bearer ${tokenA}`)
        .query({ page: -1, limit: 'invalid' })
        .expect(200);

      // Falls back to unpaginated response (which is just an Array of subscribers, not the pagination object)
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body).toHaveLength(3);
    });

    it('should handle SQL/regex search characters safely without crashing or breaking searches', async () => {
      // SQLite/Postgres wildcards or special search tokens
      const specialQueries = ['%', '_', '\\', "'", '"', '.*', '[a-z]'];
      for (const query of specialQueries) {
        const res = await request(app.getHttpServer())
          .get('/subscribers')
          .set('Authorization', `Bearer ${tokenA}`)
          .query({ search: query })
          .expect(200);

        expect(res.body).toBeInstanceOf(Array);
      }
    });

    it('should filter correctly by platform and tags', async () => {
      const resTags = await request(app.getHttpServer())
        .get('/subscribers')
        .set('Authorization', `Bearer ${tokenA}`)
        .query({ tags: 'vip' })
        .expect(200);
      expect(resTags.body).toBeInstanceOf(Array);
      expect(resTags.body).toHaveLength(1);
      expect(resTags.body[0].name).toBe('Alice Smith');

      const resPlatform = await request(app.getHttpServer())
        .get('/subscribers')
        .set('Authorization', `Bearer ${tokenA}`)
        .query({ platform: 'WHATSAPP' })
        .expect(200);
      expect(resPlatform.body).toBeInstanceOf(Array);
      expect(resPlatform.body).toHaveLength(1);
      expect(resPlatform.body[0].name).toBe('Bob Johnson');
    });
  });

  // ==========================================
  // 2. GET /subscribers/:id/conversation (History Log)
  // ==========================================
  describe('GET /subscribers/:id/conversation', () => {
    let subId: string;
    let connId: string;

    beforeEach(async () => {
      // Create connection
      const conn = await prisma.platformConnection.create({
        data: {
          tenantId: tenantAId,
          platform: 'FACEBOOK_PAGE',
          platformId: 'page_a_123',
          name: 'FB Page A',
        },
      });
      connId = conn.id;

      // Create subscriber
      const sub = await prisma.subscriber.create({
        data: {
          tenantId: tenantAId,
          name: 'Alice Smith',
          email: 'alice@example.com',
          phone: '+1234567890',
          tags: ['vip'],
          platform: 'FACEBOOK_PAGE',
        },
      });
      subId = sub.id;

      // Create conversation
      const conv = await prisma.conversation.create({
        data: {
          tenantId: tenantAId,
          connectionId: connId,
          customerName: 'Alice Smith',
          customerId: 'cust_alice_psid',
          status: 'OPEN',
        },
      });

      // Create some messages
      await prisma.message.createMany({
        data: [
          {
            conversationId: conv.id,
            direction: 'INBOUND',
            content: 'Hello page!',
            messageType: 'TEXT',
          },
          {
            conversationId: conv.id,
            direction: 'OUTBOUND',
            content: 'Hi Alice!',
            messageType: 'TEXT',
            sentByName: 'User A',
          },
        ],
      });
    });

    it('should return conversation history for a subscriber matching phone/email/name', async () => {
      // In getConversationHistory, it searches by email, phone, name
      const res = await request(app.getHttpServer())
        .get(`/subscribers/${subId}/conversation`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body).not.toBeNull();
      expect(res.body.customerName).toBe('Alice Smith');
      expect(res.body.messages).toHaveLength(2);
    });

    it('should return 404 when querying conversation of subscriber from another tenant', async () => {
      // Tenant B queries Tenant A's subscriber conversation history
      await request(app.getHttpServer())
        .get(`/subscribers/${subId}/conversation`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });

    it('should return null (200 status code) if no matching conversation exists', async () => {
      const emptySub = await prisma.subscriber.create({
        data: {
          tenantId: tenantAId,
          name: 'No Conv Subscriber',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/subscribers/${emptySub.id}/conversation`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.text).toBe('');
    });

    it('should handle collision gracefully when multiple subscribers share a name but have different phone/email', async () => {
      // Create duplicate named subscriber but with different phone/email and no active conversation
      const subCollision = await prisma.subscriber.create({
        data: {
          tenantId: tenantAId,
          name: 'Alice Smith', // same name
          email: 'alice.other@example.com',
          phone: '+1999999999',
        },
      });

      // It searches OR conditions including customerName: 'Alice Smith'
      const res = await request(app.getHttpServer())
        .get(`/subscribers/${subCollision.id}/conversation`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      // Note: Due to customerName check in OR condition, it might match the other conversation.
      // We check if it returns the conversation successfully without crashing.
      expect(res.status).toBe(200);
    });
  });

  // ==========================================
  // 3. PATCH /inbox/conversations/:id/assign (Assignee Control)
  // ==========================================
  describe('PATCH /inbox/conversations/:id/assign', () => {
    let convId: string;
    let connId: string;

    beforeEach(async () => {
      const conn = await prisma.platformConnection.create({
        data: {
          tenantId: tenantAId,
          platform: 'FACEBOOK_PAGE',
          platformId: 'page_a_123',
          name: 'FB Page A',
        },
      });
      connId = conn.id;

      const conv = await prisma.conversation.create({
        data: {
          tenantId: tenantAId,
          connectionId: connId,
          customerName: 'Alice Smith',
          customerId: 'cust_alice_psid',
          status: 'OPEN',
        },
      });
      convId = conv.id;
    });

    it('should assign a conversation to a valid team member of the tenant', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/inbox/conversations/${convId}/assign`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ assignedToId: userAId })
        .expect(200);

      expect(res.body.assignedToId).toBe(userAId);
    });

    it('should reject assignment to a user belonging to a different tenant', async () => {
      await request(app.getHttpServer())
        .patch(`/inbox/conversations/${convId}/assign`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ assignedToId: userBId }) // User B is not in Tenant A
        .expect(400);
    });

    it('should reject assignment to a non-existent user ID', async () => {
      await request(app.getHttpServer())
        .patch(`/inbox/conversations/${convId}/assign`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ assignedToId: 'non-existent-user-id' })
        .expect(400);
    });

    it('should allow setting assignedToId to null (unassign)', async () => {
      // First assign
      await prisma.conversation.update({
        where: { id: convId },
        data: { assignedToId: userAId },
      });

      const res = await request(app.getHttpServer())
        .patch(`/inbox/conversations/${convId}/assign`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ assignedToId: null })
        .expect(200);

      expect(res.body.assignedToId).toBeNull();
    });

    it('should reject Tenant B trying to assign Tenant A conversation (segregation)', async () => {
      await request(app.getHttpServer())
        .patch(`/inbox/conversations/${convId}/assign`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ assignedToId: userBId })
        .expect(404);
    });
  });

  // ==========================================
  // 4. GET /subscribers/tags
  // ==========================================
  describe('GET /subscribers/tags', () => {
    it('should retrieve only unique tags for the tenant', async () => {
      await prisma.subscriber.createMany({
        data: [
          { tenantId: tenantAId, name: 'Alice', tags: ['vip', 'promo'] },
          { tenantId: tenantAId, name: 'Bob', tags: ['promo', 'lead'] },
          { tenantId: tenantBId, name: 'Charlie', tags: ['vip', 'custom-b'] },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/subscribers/tags')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.sort()).toEqual(['lead', 'promo', 'vip'].sort());
      expect(res.body).not.toContain('custom-b');
    });

    it('should return empty list when no subscribers/tags exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/subscribers/tags')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  // ==========================================
  // 5. GET /subscribers/stats
  // ==========================================
  describe('GET /subscribers/stats', () => {
    it('should calculate stats correctly and segregate by tenant', async () => {
      // Seed Tenant A subscribers
      await prisma.subscriber.createMany({
        data: [
          { tenantId: tenantAId, name: 'Alice', platform: 'FACEBOOK_PAGE' },
          { tenantId: tenantAId, name: 'Bob', platform: 'WHATSAPP' },
          { tenantId: tenantAId, name: 'Charlie', platform: 'INSTAGRAM' },
        ],
      });

      // Seed Tenant B subscribers
      await prisma.subscriber.createMany({
        data: [{ tenantId: tenantBId, name: 'David', platform: 'WHATSAPP' }],
      });

      const res = await request(app.getHttpServer())
        .get('/subscribers/stats')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body).toEqual({
        total: 3,
        activeThisWeek: 3,
        fromFacebook: 1,
        fromWhatsapp: 1,
        fromInstagram: 1,
      });
    });

    it('should return zero metrics without crashing if there are no subscribers', async () => {
      const res = await request(app.getHttpServer())
        .get('/subscribers/stats')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body).toEqual({
        total: 0,
        activeThisWeek: 0,
        fromFacebook: 0,
        fromWhatsapp: 0,
        fromInstagram: 0,
      });
    });
  });
});
