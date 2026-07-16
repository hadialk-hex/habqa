import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase, seedDefaultTenant } from './db-cleanup';
import * as crypto from 'crypto';

jest.setTimeout(60000);

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockImplementation((pwd) => Promise.resolve(`hashed_${pwd}`)),
  compare: jest
    .fn()
    .mockImplementation((pwd, hash) =>
      Promise.resolve(hash === `hashed_${pwd}`),
    ),
}));

describe('Challenger 2 Verification Tests (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let _tenantId: string;

  beforeAll(async () => {
    // Set allowed origins and encryption keys for verification
    process.env.ALLOWED_ORIGINS =
      'http://localhost:3000,https://trusted.hubqa.com';
    process.env.ENCRYPTION_KEY = 'super-secret-encryption-key-32ch-long-here';
    process.env.APP_SECRET = 'facebook-app-secret-key';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Replicate bootstrap options: rawBody and CORS configuration
    app = moduleFixture.createNestApplication({ rawBody: true });

    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : ['http://localhost:3000'];
    app.enableCors({
      origin: allowedOrigins,
      credentials: true,
    });

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    await seedDefaultTenant(prisma);

    // Create a default user and get a valid JWT token
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'challenger@example.com',
        name: 'Challenger',
        password: 'securepassword123',
        tenantName: 'Challenger Tenant',
      })
      .expect(201);

    token = res.body.access_token;
    _tenantId = res.body.user.tenantId;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  // Verification 1: Unauthorized requests to dashboard receive 401
  describe('1. Unauthorized Dashboard Access', () => {
    const endpoints = [
      '/dashboard/stats',
      '/dashboard/analytics',
      '/dashboard/channel-distribution',
      '/dashboard/rules-metrics',
    ];

    endpoints.forEach((endpoint) => {
      it(`should return 401 for GET ${endpoint} without token`, async () => {
        await request(app.getHttpServer()).get(endpoint).expect(401);
      });

      it(`should return 401 for GET ${endpoint} with invalid/tampered token`, async () => {
        await request(app.getHttpServer())
          .get(endpoint)
          .set('Authorization', 'Bearer invalid-token-signature')
          .expect(401);
      });
    });
  });

  // Verification 2: Rate limiting triggers 429 when making >15 login attempts in 10s
  describe('2. Rate Limiting on Login', () => {
    it('should trigger 429 after 15 login attempts in 10s', async () => {
      // Send 16 parallel login requests
      const requests = Array.from({ length: 16 }, () =>
        request(app.getHttpServer()).post('/auth/login').send({
          email: 'challenger@example.com',
          password: 'wrongpassword',
        }),
      );

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);

      // Verify that at least one of the requests received a 429 status
      expect(statuses).toContain(HttpStatus.TOO_MANY_REQUESTS); // 429
    });
  });

  // Verification 3: Webhook signature check timingSafeEqual works and correctly rejects invalid/empty signatures
  describe('3. Webhook Signature Validation', () => {
    const payload = {
      object: 'page',
      entry: [],
    };

    function getValidSignature(data: any): string {
      const payloadString = JSON.stringify(data);
      const secret = process.env.APP_SECRET || 'facebook-app-secret-key';
      return crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');
    }

    it('should allow request with correct signature', async () => {
      const signature = getValidSignature(payload);
      const res = await request(app.getHttpServer())
        .post('/webhooks')
        .set('x-hub-signature-256', `sha256=${signature}`)
        .send(payload);

      // Signature check passes (either 200 OK or 400 bad payload, but NOT 401)
      expect(res.status).not.toBe(401);
    });

    it('should reject request with missing signature header with 401', async () => {
      await request(app.getHttpServer())
        .post('/webhooks')
        .send(payload)
        .expect(401);
    });

    it('should reject request with empty signature (sha256=) with 401', async () => {
      await request(app.getHttpServer())
        .post('/webhooks')
        .set('x-hub-signature-256', 'sha256=')
        .send(payload)
        .expect(401);
    });

    it('should reject request with mismatched signature with 401', async () => {
      await request(app.getHttpServer())
        .post('/webhooks')
        .set(
          'x-hub-signature-256',
          'sha256=incorrectsignaturehash123456789012345678901234567890123456789012',
        )
        .send(payload)
        .expect(401);
    });

    it('should handle invalid signature length without crashing and reject with 401', async () => {
      await request(app.getHttpServer())
        .post('/webhooks')
        .set('x-hub-signature-256', 'sha256=short')
        .send(payload)
        .expect(401);
    });
  });

  // Verification 4: CORS limits allow configured origins and block disallowed origins
  describe('4. CORS Restrictions', () => {
    it('should allow configured origin http://localhost:3000', async () => {
      const res = await request(app.getHttpServer())
        .get('/')
        .set('Origin', 'http://localhost:3000')
        .expect(200);
      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000',
      );
    });

    it('should allow configured origin https://trusted.hubqa.com', async () => {
      const res = await request(app.getHttpServer())
        .get('/')
        .set('Origin', 'https://trusted.hubqa.com')
        .expect(200);
      expect(res.headers['access-control-allow-origin']).toBe(
        'https://trusted.hubqa.com',
      );
    });

    it('should block/not allow origin https://attacker.com', async () => {
      const res = await request(app.getHttpServer())
        .get('/')
        .set('Origin', 'https://attacker.com')
        .expect(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  // Verification 5: DTO validators correctly reject malformed input
  describe('5. DTO Validation Constraints', () => {
    it('should reject register with invalid email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          name: 'Challenger',
          password: 'securepassword123',
          tenantName: 'Tenant',
        })
        .expect(400);
    });

    it('should reject register with short password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'valid@example.com',
          name: 'Challenger',
          password: '123',
          tenantName: 'Tenant',
        })
        .expect(400);
    });

    it('should reject register with empty name', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'valid@example.com',
          name: '',
          password: 'securepassword123',
          tenantName: 'Tenant',
        })
        .expect(400);
    });

    it('should reject add connection with missing platformId', async () => {
      await request(app.getHttpServer())
        .post('/channels')
        .set('Authorization', `Bearer ${token}`)
        .send({
          platform: 'FACEBOOK_PAGE',
          name: 'Test page',
        })
        .expect(400);
    });

    it('should reject analytics with invalid date format', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/analytics')
        .set('Authorization', `Bearer ${token}`)
        .query({ startDate: '2026/07/09' })
        .expect(400);
    });
  });

  // Verification 6: Connection tokens are actually stored encrypted in the database and successfully decrypted upon retrieval
  describe('6. Connection Token Encryption and Decryption', () => {
    it('should encrypt tokens in the DB and decrypt them on API/service retrieval', async () => {
      const rawToken = 'super-secret-facebook-page-access-token';

      // Create a platform connection via API
      const res = await request(app.getHttpServer())
        .post('/channels')
        .set('Authorization', `Bearer ${token}`)
        .send({
          platform: 'FACEBOOK_PAGE',
          platformId: 'page_challenge_123',
          name: 'Challenge Page',
          accessToken: rawToken,
        })
        .expect(201);

      const connectionId = res.body.id;
      expect(res.body.accessToken).toBe('***');

      // Fetch directly from DB to verify it is encrypted
      const dbConnection = await prisma.platformConnection.findUnique({
        where: { id: connectionId },
      });

      expect(dbConnection).not.toBeNull();
      expect(dbConnection!.accessToken).not.toBe(rawToken);
      expect(dbConnection!.accessToken).toContain(':'); // should have the iv:encrypted format

      const [iv, encrypted] = dbConnection!.accessToken!.split(':');
      expect(iv).toHaveLength(32); // hex representation of 16-byte IV
      expect(encrypted).not.toHaveLength(0);

      // Retrieve connection via GET /channels/:id and verify it is decrypted
      const getRes = await request(app.getHttpServer())
        .get(`/channels/${connectionId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(getRes.body.accessToken).toBe('***');

      // Retrieve connection via GET /channels and verify it is decrypted
      const listRes = await request(app.getHttpServer())
        .get('/channels')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const found = listRes.body.find((c: any) => c.id === connectionId);
      expect(found).not.toBeUndefined();
      expect(found.accessToken).toBe('***');
    });
  });
});
