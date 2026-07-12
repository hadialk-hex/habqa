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

describe('Auto-Reply Rules (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let tenantId: string;
  let connectionId: string;

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
        email: 'ruleowner@example.com',
        name: 'Rule Owner',
        password: 'securepassword123',
        tenantName: 'Rule Tenant',
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

  describe('Rules CRUD', () => {
    it('should create a Comment-to-DM auto-reply rule (Tier 1)', async () => {
      const res = await request(app.getHttpServer())
        .post('/rules')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Promo Code Rule',
          connectionId,
          triggerType: 'KEYWORD',
          keywords: 'سعر، تفاصيل، مهتم',
          matchType: 'CONTAINS',
          replyText: 'تم الرد في الخاص!',
          privateText: 'إليك كود الخصم: DISCOUNT10',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Promo Code Rule');
    });

    it('should retrieve all auto-reply rules for tenant (Tier 1)', async () => {
      await prisma.autoReplyRule.create({
        data: {
          tenantId,
          connectionId,
          name: 'Rule 1',
          triggerType: 'ANY_COMMENT',
          keywords: '',
          replyText: 'Hi',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/rules')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(1);
    });

    it('should update an existing auto-reply rule (Tier 1)', async () => {
      const rule = await prisma.autoReplyRule.create({
        data: {
          tenantId,
          connectionId,
          name: 'Old Rule',
          triggerType: 'ANY_COMMENT',
          keywords: '',
          replyText: 'Old reply',
        },
      });

      const res = await request(app.getHttpServer())
        .put(`/rules/${rule.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Rule',
          replyText: 'New reply',
        })
        .expect(200);

      expect(res.body.name).toBe('Updated Rule');
      expect(res.body.replyText).toBe('New reply');
    });

    it('should delete an auto-reply rule (Tier 1)', async () => {
      const rule = await prisma.autoReplyRule.create({
        data: {
          tenantId,
          connectionId,
          name: 'Rule to Delete',
          triggerType: 'ANY_COMMENT',
          keywords: '',
        },
      });

      await request(app.getHttpServer())
        .delete(`/rules/${rule.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const check = await prisma.autoReplyRule.findUnique({
        where: { id: rule.id },
      });
      expect(check).toBeNull();
    });

    it('should return 400 when creating rule with empty trigger keyword (Tier 2)', async () => {
      await request(app.getHttpServer())
        .post('/rules')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Promo Code Rule',
          connectionId,
          triggerType: 'KEYWORD',
          keywords: '',
          replyText: 'Hi',
        })
        .expect(400);
    });

    it('should return 400 when creating rule with extremely long public reply text (Tier 2)', async () => {
      const longText = 'a'.repeat(5000);
      await request(app.getHttpServer())
        .post('/rules')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Promo Code Rule',
          connectionId,
          triggerType: 'ANY_COMMENT',
          keywords: '',
          replyText: longText,
        })
        .expect(400);
    });
  });

  describe('Rule Execution & Extra Logs (Tier 1 & 2 - Expected/Mocked)', () => {
    let ruleId: string;

    beforeEach(async () => {
      const rule = await prisma.autoReplyRule.create({
        data: {
          tenantId,
          connectionId,
          name: 'Log Rule',
          triggerType: 'ANY_COMMENT',
          keywords: '',
        },
      });
      ruleId = rule.id;
    });

    it('should retrieve execution logs for comment-to-DM rule (Tier 1)', async () => {
      await request(app.getHttpServer())
        .get(`/rules/${ruleId}/logs`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should fail to trigger rule with deactivated channel (Tier 2)', async () => {
      await prisma.platformConnection.update({
        where: { id: connectionId },
        data: { isActive: false },
      });

      await request(app.getHttpServer())
        .post(`/rules/${ruleId}/trigger`)
        .set('Authorization', `Bearer ${token}`)
        .send({ comment: 'test' })
        .expect((res) => {
          expect([400, 403]).toContain(res.status);
        });
    });
  });
});
