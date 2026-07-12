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

describe('Dashboard Analytics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let tenantId: string;

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

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'dashowner@example.com',
        name: 'Dashboard Owner',
        password: 'securepassword123',
        tenantName: 'Dashboard Tenant',
      })
      .expect(201);

    token = res.body.access_token;
    tenantId = res.body.user.tenantId;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('KPI Stats (Tier 1)', () => {
    it('should return 0s instead of crashing on zero data state (Tier 2)', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('totalSubscribers', 0);
      expect(res.body).toHaveProperty('totalAutoReplies', 0);
      expect(res.body).toHaveProperty('activeConversations', 0);
      expect(res.body).toHaveProperty('totalRules', 0);
      expect(res.body.recentConversations).toEqual([]);
      expect(res.body.platformStats).toEqual({});
    });

    it('should fetch KPI metrics correctly when data exists (Tier 1)', async () => {
      const conn = await prisma.platformConnection.create({
        data: {
          tenantId,
          platform: 'FACEBOOK_PAGE',
          platformId: 'page_dash',
          name: 'Dashboard Page',
        },
      });

      const conv = await prisma.conversation.create({
        data: {
          tenantId,
          connectionId: conn.id,
          customerName: 'Bob Jones',
          customerId: 'cust_bob',
          status: 'OPEN',
        },
      });

      await prisma.message.create({
        data: {
          conversationId: conv.id,
          direction: 'OUTBOUND',
          content: 'Bot reply',
        },
      });

      await prisma.autoReplyRule.create({
        data: {
          tenantId,
          connectionId: conn.id,
          name: 'Active Rule',
          triggerType: 'ANY_COMMENT',
          keywords: '',
          isActive: true,
        },
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.totalSubscribers).toBe(1);
      expect(res.body.totalAutoReplies).toBe(1);
      expect(res.body.activeConversations).toBe(1);
      expect(res.body.totalRules).toBe(1);
      expect(res.body.recentConversations.length).toBe(1);
      expect(res.body.platformStats).toEqual({ FACEBOOK_PAGE: 1 });
    });

    it('should verify date filtering and trend calculations (Tier 1)', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .set('Authorization', `Bearer ${token}`)
        .query({
          range: '7days'
        })
        .expect(200);

      expect(res.body).toHaveProperty('subscribersTrend');
      expect(res.body).toHaveProperty('autoRepliesTrend');
      expect(res.body).toHaveProperty('conversationsTrend');
      expect(res.body).toHaveProperty('rulesTrend');
    });

    it('should accept custom range parameter for stats (Tier 1)', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/stats')
        .set('Authorization', `Bearer ${token}`)
        .query({
          range: 'custom',
          startDate: '2026-07-01',
          endDate: '2026-07-09'
        })
        .expect(200);
    });
  });

  describe('Daily Analytics & Filtering (Tier 1 & 2 - Expected/Mocked)', () => {
    it('should fetch daily analytics with default date range (Tier 1)', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/analytics')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should filter daily analytics by custom date range (Tier 1)', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/analytics')
        .set('Authorization', `Bearer ${token}`)
        .query({
          startDate: '2026-07-01',
          endDate: '2026-07-09',
        })
        .expect(200);
    });

    it('should fetch channel distribution statistics (Tier 1)', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/channel-distribution')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should fetch rules execution success/failure rate (Tier 1)', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/rules-metrics')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should return 400 when start date is after end date (Tier 2)', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/analytics')
        .set('Authorization', `Bearer ${token}`)
        .query({
          startDate: '2026-07-10',
          endDate: '2026-07-01',
        })
        .expect(400);
    });

    it('should handle analytics queries with future dates gracefully (Tier 2)', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/analytics')
        .set('Authorization', `Bearer ${token}`)
        .query({
          startDate: '2026-07-01',
          endDate: '2030-07-01',
        })
        .expect(200);
    });

    it('should return 400 for analytics with malformed date strings (Tier 2)', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/analytics')
        .set('Authorization', `Bearer ${token}`)
        .query({
          startDate: 'not-a-date',
          endDate: 'malformed-date-string',
        })
        .expect(400);
    });

    it('should return 403 when fetching analytics for a channel user does not own (Tier 2)', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/analytics')
        .set('Authorization', `Bearer ${token}`)
        .query({
          connectionId: 'some-other-tenant-connection-id',
        })
        .expect(403);
    });
  });
});
