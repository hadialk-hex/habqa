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

describe('Security, CORS & Rate Limiting (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableCors({
      origin: ['http://localhost:3000', 'https://trusted.hubqa.com'],
    });
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    await seedDefaultTenant(prisma);

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'securityowner@example.com',
        name: 'Security User',
        password: 'securepassword123',
        tenantName: 'Security Tenant',
      })
      .expect(201);
    token = res.body.access_token;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('AuthGuard & Access Control', () => {
    it('should access public endpoints without JWT token (Tier 1)', async () => {
      await request(app.getHttpServer()).get('/').expect(200);
    });

    it('should return 401 when accessing dashboard without JWT token (Tier 2)', async () => {
      await request(app.getHttpServer()).get('/dashboard/stats').expect(401);
    });

    it('should access dashboard endpoints with valid JWT token (Tier 1)', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should fail JWT validation with signature mismatch (Tier 2)', async () => {
      const tamperedToken = token + 'tamper';
      await request(app.getHttpServer())
        .get('/dashboard/stats')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);
    });
  });

  describe('CORS Validation', () => {
    it('should present CORS headers on valid origin (Tier 1)', async () => {
      const res = await request(app.getHttpServer())
        .get('/')
        .set('Origin', 'https://trusted.hubqa.com')
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBe(
        'https://trusted.hubqa.com',
      );
    });

    it('should reject CORS origin not in allowed list (Tier 2)', async () => {
      await request(app.getHttpServer())
        .get('/')
        .set('Origin', 'https://attacker.com')
        .expect((res) => {
          expect(res.headers['access-control-allow-origin']).toBeUndefined();
        });
    });
  });

  describe('Rate Limiting (Throttling)', () => {
    it('should trigger rate limiting 429 when limits are exceeded (Tier 1 & 2)', async () => {
      const requests = Array.from({ length: 16 }, () =>
        request(app.getHttpServer()).get('/'),
      );

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);

      expect(statuses).toContain(429);
    });
  });

  describe('Secure Headers (Tier 2)', () => {
    it('should contain standard secure headers (Tier 2)', async () => {
      const res = await request(app.getHttpServer()).get('/');
      expect(res.headers).toHaveProperty('x-content-type-options');
    });
  });
});
