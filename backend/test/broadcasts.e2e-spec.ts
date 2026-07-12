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

describe('Broadcasts (e2e)', () => {
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
        email: 'broadcastowner@example.com',
        name: 'Broadcast Owner',
        password: 'securepassword123',
        tenantName: 'Broadcast Tenant',
      })
      .expect(201);

    token = res.body.access_token;
    tenantId = res.body.user.tenantId;

    await prisma.broadcast.create({
      data: {
        id: 'mocked-broadcast-id-123',
        tenantId,
        name: 'Mocked Broadcast',
        content: 'Mocked content',
        segmentTarget: 'all',
        status: 'DRAFT',
      },
    });

    await prisma.broadcast.create({
      data: {
        id: 'already-sent-id',
        tenantId,
        name: 'Already Sent Campaign',
        content: 'Already sent content',
        segmentTarget: 'all',
        status: 'SENT',
      },
    });
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('Broadcast Life Cycle (Tier 1 - Expected/Mocked)', () => {
    let broadcastId = 'mocked-broadcast-id-123';

    it('should create a broadcast draft (Tier 1)', async () => {
      const res = await request(app.getHttpServer())
        .post('/broadcasts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Summer Promo Campaign',
          content: 'Hello customer! Special summer sale is on!',
          segmentTarget: 'all',
        })
        .expect(201);

      if (res.status === 201) {
        expect(res.body).toHaveProperty('id');
      }
    });

    it('should schedule broadcast to be sent (Tier 1)', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await request(app.getHttpServer())
        .post(`/broadcasts/${broadcastId}/schedule`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          scheduledAt: futureDate,
        })
        .expect(200);
    });

    it('should execute broadcast immediately to target segment (Tier 1)', async () => {
      await request(app.getHttpServer())
        .post(`/broadcasts/${broadcastId}/execute`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should view broadcast execution metrics (Tier 1)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/broadcasts/${broadcastId}/metrics`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      if (res.status === 200) {
        expect(res.body).toHaveProperty('sentCount');
        expect(res.body).toHaveProperty('deliveredCount');
      }
    });

    it('should cancel a scheduled broadcast (Tier 1)', async () => {
      await request(app.getHttpServer())
        .post(`/broadcasts/${broadcastId}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should retrieve all broadcasts (Tier 1)', async () => {
      const res = await request(app.getHttpServer())
        .get('/broadcasts')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('name');
    });
  });

  describe('Broadcast Boundaries & Failures (Tier 2 - Expected/Mocked)', () => {
    it('should return 400 when scheduling broadcast in the past (Tier 2)', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      await request(app.getHttpServer())
        .post('/broadcasts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Past Campaign',
          content: 'Hello!',
          segmentTarget: 'all',
          scheduledAt: pastDate,
        })
        .expect(400);
    });

    it('should return 400 when creating broadcast with invalid segment target (Tier 2)', async () => {
      await request(app.getHttpServer())
        .post('/broadcasts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Invalid Segment Campaign',
          content: 'Hello!',
          segmentTarget: 'invalid_segment_type_123',
        })
        .expect(400);
    });

    it('should return 400 when creating broadcast with empty message content (Tier 2)', async () => {
      await request(app.getHttpServer())
        .post('/broadcasts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Empty Content Campaign',
          content: '',
          segmentTarget: 'all',
        })
        .expect(400);
    });

    it('should return 400 when canceling already sent broadcast (Tier 2)', async () => {
      await request(app.getHttpServer())
        .post('/broadcasts/already-sent-id/cancel')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return 404 when fetching non-existent broadcast (Tier 2)', async () => {
      await request(app.getHttpServer())
        .get('/broadcasts/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
