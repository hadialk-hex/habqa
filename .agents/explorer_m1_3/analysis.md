# E2E Testing Strategy Analysis: Security, Rate Limiting, CORS, and Password Reset

## 1. Executive Summary
This report analyzes the backend authentication module, CORS configuration, rate limiting, and password reset functionalities of the Hubqa NestJS backend, and outlines a comprehensive End-to-End (E2E) testing strategy.

The current implementation has:
- A functional authentication module utilizing JWT tokens and a `JwtAuthGuard` applied to dashboard and rules routes.
- Permissive CORS settings (`app.enableCors()`) allowing all origins.
- No rate limiting capabilities configured or installed.
- No password reset database schema or endpoint logic implemented.

This document proposes:
1. **Expected implementation designs** for the missing security features (rate limiting, strict CORS, password reset schema/logic).
2. **A concrete E2E testing architecture** using **Jest + Supertest** along with **Prisma client inspection** and **NestJS Provider Overrides** to verify these features reliably without network dependencies or test flakiness.

---

## 2. Current State Analysis

### 2.1 Backend Auth Module
- **Guards**: `JwtAuthGuard` is implemented in `backend/src/auth/guards/jwt-auth.guard.ts` as a passport-jwt strategy extension.
- **Enforcement**:
  - `DashboardController` (`dashboard.controller.ts`) is protected by `@UseGuards(JwtAuthGuard)` at the class level.
  - `ChannelsController`, `RulesController`, and `InboxController` are also protected by `@UseGuards(JwtAuthGuard)` at the class level.
  - `WebhooksController` remains public (unprotected) to allow incoming Meta callbacks.
- **Gaps**: There are currently no endpoints or database fields for password reset, email dispatch, or token validation.

### 2.2 Rate Limiter Configuration
- **Current State**: There is **no rate limiter** configured. The package `@nestjs/throttler` is not present in `package.json`, and no guard is applied.
- **Required Hardening**: Implement a rate limiter restricting requests to `/auth/login` to `15 login attempts per 10 seconds` returning HTTP `429 Too Many Requests`.

### 2.3 CORS Setup
- **Current State**: `backend/src/main.ts` calls `app.enableCors()` with no options. This defaults to wildcard `*` behavior, permitting any origin.
- **Required Hardening**: Restrict CORS to specific origins fetched from the environment variable (e.g. `ALLOWED_ORIGINS`), supporting origin validation.

### 2.4 Password Reset Email Generation and Token Validation
- **Current State**: Not implemented.
- **Required Hardening**:
  - Extend `schema.prisma` with a `PasswordResetToken` model.
  - Create a `MailerService` (or wrapper around `nodemailer`) to send emails containing the reset link.
  - Implement `POST /auth/forgot-password` (generates token, saves to DB, emails link).
  - Implement `POST /auth/reset-password` (accepts token + new password, validates token, hashes and updates password, deletes token).

---

## 3. E2E Testing Strategy

### 3.1 AuthGuard Protection on Dashboard Routes
- **Verification Target**: Ensure unauthorized requests receive `401 Unauthorized` while valid requests succeed.
- **Test Cases**:
  1. Request `GET /dashboard/stats` without `Authorization` header -> Assert `401 Unauthorized`.
  2. Request `GET /dashboard/stats` with a malformed bearer token -> Assert `401 Unauthorized`.
  3. Request `GET /dashboard/stats` with a valid JWT token -> Assert `200 OK`.

### 3.2 Rate Limiting on `/auth/login`
- **Challenge**: Testing `15 requests in 10 seconds` requires high execution counts and can trigger blocks for subsequent test files if the IP is throttled globally.
- **Mitigation Strategy**:
  1. **Configure Custom Limits for Tests**: Set lower, fast-failing limits in the test environment (e.g., `ttl: 1000` (1s) and `limit: 3`) using environment variables or a configuration override.
  2. **Bypass on Non-Rate-Limit Tests**: If rate limiting is applied globally, bypass the guard in non-throttler test suites by injecting a custom guard override or checking `DISABLE_RATE_LIMIT=true`.
- **Test Cases**:
  1. Send 15 requests sequentially to `/auth/login` -> Assert all return `200 OK` or `401 Unauthorized` (depending on credentials).
  2. Send the 16th request to `/auth/login` within 10 seconds -> Assert HTTP `429 Too Many Requests` is returned.

### 3.3 CORS Origin Validation
- **Verification Target**: Ensure only allowed origins can communicate with the backend.
- **Test Cases**:
  1. Request `GET /` with header `Origin: http://localhost:3000` (allowed) -> Assert `Access-Control-Allow-Origin` header matches the origin.
  2. Request `GET /` with header `Origin: http://malicious.com` (disallowed) -> Assert `Access-Control-Allow-Origin` is absent, or response is blocked.
  3. Request `GET /` without `Origin` header (internal/server call) -> Assert request succeeds and no CORS headers are returned.

### 3.4 Password Reset Email Generation and Token Validation
- **Challenge**: We cannot verify actual email receipt in E2E tests, and we need to obtain the reset token to complete the password reset flow.
- **Strategy**:
  1. **Mailer Service Mocking (Provider Override)**: Create a `MailerService` in the backend. In the E2E test setup, override `MailerService` with a mock to inspect sent parameters and verify email generation.
  2. **Direct DB Inspection**: Rather than extracting the token from a mock email, query the SQLite/PostgreSQL test database directly via the `PrismaService` to retrieve the generated token.
  3. **Multi-Step Flow Execution**:
     - Call `POST /auth/forgot-password` with a valid user email.
     - Retrieve the token from the database.
     - Call `POST /auth/reset-password` with the token and a new password -> Assert success.
     - Try to reuse the same token again -> Assert error (token deleted/invalidated).
     - Try to log in with the new password -> Assert success.
     - Try to log in with the old password -> Assert `401 Unauthorized`.

---

## 4. Concrete Code & Implementation Designs

### 4.1 Proposed Implementation Code

#### Rate Limiter (Throttler) setup in `app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ThrottlerModule.forRoot([{
      // Use config variables to make testing easier
      ttl: Number(process.env.THROTTLE_TTL) || 10000, 
      limit: Number(process.env.THROTTLE_LIMIT) || 15,
    }]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

#### CORS Origin setup in `main.ts`:
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000'];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
```

#### Prisma Schema Extensions for Password Reset:
```prisma
model PasswordResetToken {
  id        String   @id @default(uuid())
  email     String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([email])
}
```

---

### 4.2 Proposed E2E Test Suite Code (`backend/test/security.e2e-spec.ts`)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailerService } from '../src/mail/mailer.service';
import * as bcrypt from 'bcrypt';

describe('Security and Auth Guard E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  // Mock Mailer Service
  const mockMailerService = {
    sendResetEmail: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    // Override throttler limits for rapid testing
    process.env.THROTTLE_TTL = '1000'; // 1 second
    process.env.THROTTLE_LIMIT = '3';   // limit to 3 requests
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:3001';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue(mockMailerService)
      .compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    // Cleanup databases
    await prisma.passwordResetToken.deleteMany({});
    await prisma.user.deleteMany({});
    await app.close();
  });

  describe('CORS Origin Validation', () => {
    it('should allow requests from configured allowed origins', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/login')
        .set('Origin', 'http://localhost:3000');
      
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should block requests from non-configured origins', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/login')
        .set('Origin', 'http://malicious.com');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('AuthGuard Protection on Dashboard Routes', () => {
    it('should deny access to dashboard stats without a bearer token (401)', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/stats')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should deny access to dashboard stats with invalid token (401)', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/stats')
        .set('Authorization', 'Bearer invalid-token-value')
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('Rate Limiting on /auth/login', () => {
    it('should enforce throttle limits and return 429 after limit is exceeded', async () => {
      const loginPayload = { email: 'test@example.com', password: 'password123' };

      // Send 3 requests (within our overridden limit of 3)
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send(loginPayload)
          // We expect UNAUTHORIZED or OK but NOT 429
          .then(res => {
            expect(res.status).not.toBe(HttpStatus.TOO_MANY_REQUESTS);
          });
      }

      // 4th request must trigger the throttler (HTTP 429)
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginPayload)
        .expect(HttpStatus.TOO_MANY_REQUESTS);
    });
  });

  describe('Password Reset Flow and Token Validation', () => {
    const userEmail = 'reset-test@hubqa.com';
    const originalPassword = 'securePassword123';
    const newPassword = 'updatedPassword456';

    beforeAll(async () => {
      // Pre-seed a test user
      const hashedPassword = await bcrypt.hash(originalPassword, 10);
      await prisma.user.create({
        data: {
          email: userEmail,
          password: hashedPassword,
        },
      });
    });

    it('should execute full password reset flow successfully', async () => {
      mockMailerService.sendResetEmail.mockClear();

      // 1. Request password reset email
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: userEmail })
        .expect(HttpStatus.OK);

      // Verify MailerService was triggered
      expect(mockMailerService.sendResetEmail).toHaveBeenCalledWith(
        userEmail,
        expect.any(String) // token or reset link
      );

      // 2. Query token directly from the database
      const resetTokenRecord = await prisma.passwordResetToken.findFirst({
        where: { email: userEmail },
      });
      expect(resetTokenRecord).toBeDefined();
      expect(resetTokenRecord?.token).toBeDefined();

      const validToken = resetTokenRecord!.token;

      // 3. Reset password using valid token
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: validToken, password: newPassword })
        .expect(HttpStatus.OK);

      // 4. Verify token is deleted/invalidated
      const expiredTokenRecord = await prisma.passwordResetToken.findFirst({
        where: { token: validToken },
      });
      expect(expiredTokenRecord).toBeNull();

      // Try to reset password again using same token -> Should fail
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: validToken, password: 'anotherPassword789' })
        .expect(HttpStatus.BAD_REQUEST);

      // 5. Try logging in with the old password -> Should fail
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: userEmail, password: originalPassword })
        .expect(HttpStatus.UNAUTHORIZED);

      // 6. Try logging in with the new password -> Should succeed
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: userEmail, password: newPassword })
        .expect(HttpStatus.OK);

      expect(loginRes.body.access_token).toBeDefined();
    });
  });
});
```

---

## 5. Summary Recommendations
1. **Parameterize Rate Limiting**: Ensure that the Throttler parameters (TTL and Limit) are configurable via environment variables or NestJS config so that E2E tests can easily override them to avoid slow, hanging test executions.
2. **Avoid Global Test Rate Limiting**: For the main test suite, keep the rate limiter bypassed, and only assert on the rate limits inside a dedicated spec file where limits are configured with low thresholds (e.g., limit of 3).
3. **Database-Driven Token Harvesting**: Rather than setting up complex mock SMTP servers or parsing console outputs, E2E tests should retrieve password reset tokens directly from the Prisma database using queries. This keeps the test suite robust, fast, and independent of transport mechanisms.
4. **CORS Testing Headers**: E2E tests for CORS should always pass the `Origin` header and verify the response header `access-control-allow-origin` explicitly.
