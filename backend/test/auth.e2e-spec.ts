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

describe('Auth & Profile (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('User Registration & Login', () => {
    const registerDto = {
      email: 'test@example.com',
      name: 'Test User',
      password: 'securepassword123',
      tenantName: 'Test Tenant',
    };

    it('should register a new user successfully (Tier 1)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      expect(res.body).toHaveProperty('access_token');
      expect(res.body.user).toHaveProperty('email', registerDto.email);
      expect(res.body.user).toHaveProperty('name', registerDto.name);
    });

    it('should login with correct credentials (Tier 1)', async () => {
      // Register first
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: registerDto.email,
          password: registerDto.password,
        })
        .expect(200);

      expect(res.body).toHaveProperty('access_token');
      expect(res.body.user.email).toBe(registerDto.email);
    });

    it('should return 409 when registering with duplicate email (Tier 2)', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(409);
    });

    it('should return 400 when registering with short password (Tier 2)', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...registerDto,
          password: 'short',
        })
        .expect(400);
    });

    it('should return 401 when logging in with incorrect password (Tier 2)', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: registerDto.email,
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });

  describe('Profile CRUD (Tier 1 & 2 - Expected/Mocked)', () => {
    let token: string;
    const registerDto = {
      email: 'profile@example.com',
      name: 'Profile User',
      password: 'securepassword123',
      tenantName: 'Profile Tenant',
    };

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);
      token = res.body.access_token;
    });

    it('should fetch the profile of logged-in user (Tier 1)', async () => {
      // Expect 200 when profile endpoint is fully implemented
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should update profile name and details (Tier 1)', async () => {
      // Expect 200 when profile patch is fully implemented
      await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' })
        .expect(200);
    });

    it('should return 400 when updating profile with invalid field types (Tier 2)', async () => {
      await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 12345 }) // invalid type
        .expect(400);
    });
  });

  describe('Password Reset Flow (Tier 1 & 2 - Expected/Mocked)', () => {
    beforeEach(async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          password: 'hashed_securepassword123',
          memberships: {
            create: {
              tenantId: 'demo-tenant-id',
              role: 'MEMBER',
            },
          },
        },
      });

      await prisma.passwordResetToken.create({
        data: {
          token: 'valid_reset_token',
          userId: user.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await prisma.passwordResetToken.create({
        data: {
          token: 'expired_reset_token',
          userId: user.id,
          expiresAt: new Date(Date.now() - 60 * 60 * 1000),
        },
      });
    });

    it('should request password reset token with valid email (Tier 1)', async () => {
      await request(app.getHttpServer())
        .post('/auth/password-reset')
        .send({ email: 'test@example.com' })
        .expect(201);
    });

    it('should return 404 when requesting reset for non-existent email (Tier 2)', async () => {
      await request(app.getHttpServer())
        .post('/auth/password-reset')
        .send({ email: 'nonexistent@example.com' })
        .expect(404);
    });

    it('should reset password with valid token (Tier 1)', async () => {
      await request(app.getHttpServer())
        .post('/auth/password-reset/reset')
        .send({
          token: 'valid_reset_token',
          password: 'newsecurepassword123',
        })
        .expect(200);
    });

    it('should return 400 when resetting with expired token (Tier 2)', async () => {
      await request(app.getHttpServer())
        .post('/auth/password-reset/reset')
        .send({
          token: 'expired_reset_token',
          password: 'newsecurepassword123',
        })
        .expect(400);
    });

    it('should return 400 when resetting with malformed token (Tier 2)', async () => {
      await request(app.getHttpServer())
        .post('/auth/password-reset/reset')
        .send({
          token: 'invalid',
          password: 'newsecurepassword123',
        })
        .expect(400);
    });

    it('should limit password reset link creation rate on repeated requests (Tier 2)', async () => {
      const email = 'test@example.com';
      await request(app.getHttpServer())
        .post('/auth/password-reset')
        .send({ email });
      await request(app.getHttpServer())
        .post('/auth/password-reset')
        .send({ email });
      await request(app.getHttpServer())
        .post('/auth/password-reset')
        .send({ email })
        .expect(429);
    });
  });
});
