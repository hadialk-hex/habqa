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

describe('Health & System Checks (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

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
        email: 'healthowner@example.com',
        name: 'Health Admin',
        password: 'securepassword123',
        tenantName: 'Health Tenant',
      })
      .expect(201);
    token = res.body.access_token;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('Health Checks', () => {
    it('should return status ok on GET /health (Tier 1)', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);

      expect(res.body).toHaveProperty('status', 'ok');
    });

    it('should return status of database connection in health check (Tier 1)', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);

      expect(res.body).toHaveProperty('details');
      expect(res.body.details).toHaveProperty('database');
      expect(res.body.details.database).toHaveProperty('status', 'up');
    });

    it('should return 503 for database health check when connection is closed (Tier 2)', async () => {
      await request(app.getHttpServer())
        .get('/health')
        .query({ simulateDbFailure: 'true' })
        .expect(503);
    });
  });

  describe('System Info & Config Limits', () => {
    it('should fetch API documentation or config limits (Tier 1)', async () => {
      const res = await request(app.getHttpServer())
        .get('/system/config-limits')
        .expect(200);

      expect(res.body).toHaveProperty('maxRulesPerTenant');
      expect(res.body).toHaveProperty('maxConnectionsPerTenant');
    });

    it('should request rate limiting config options (Tier 1)', async () => {
      const res = await request(app.getHttpServer())
        .get('/system/rate-limits')
        .expect(200);

      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('ttl');
    });
  });

  describe('Session Logout Validation', () => {
    it('should verify logout invalidates backend session/token representation (Tier 1)', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/dashboard/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });
});
