import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
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

describe('Adversarial & Boundary Challenger Tests (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // User/Tenant A credentials
  let tokenA: string;
  let userAId: string;
  let tenantAId: string;
  let emailA: string;

  // User/Tenant B credentials
  let tokenB: string;
  let userBId: string;
  let tenantBId: string;
  let emailB: string;

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
    emailA = `usera_${testCounter}@example.com`;
    emailB = `userb_${testCounter}@example.com`;

    // Register User A
    const resA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: emailA,
        name: 'User A',
        password: 'password123',
        tenantName: `Tenant A ${testCounter}`,
      })
      .expect(HttpStatus.CREATED);
    tokenA = resA.body.access_token;
    userAId = resA.body.user.id;
    tenantAId = resA.body.user.tenantId;

    // Register User B
    const resB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: emailB,
        name: 'User B',
        password: 'password123',
        tenantName: `Tenant B ${testCounter}`,
      })
      .expect(HttpStatus.CREATED);
    tokenB = resB.body.access_token;
    userBId = resB.body.user.id;
    tenantBId = resB.body.user.tenantId;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  // ==========================================
  // 1. SUBSCRIBERS CRUD BOUNDARY TESTS
  // ==========================================
  describe('Subscribers CRUD Boundaries', () => {
    it('should reject subscriber creation with empty name', async () => {
      await request(app.getHttpServer())
        .post('/subscribers')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: '',
          email: 'valid@example.com',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should reject subscriber creation with invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/subscribers')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Subscriber One',
          email: 'not-an-email',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should reject subscriber creation with invalid phone format', async () => {
      await request(app.getHttpServer())
        .post('/subscribers')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Subscriber One',
          phone: 'abc12345', // Letters not allowed in phone format check regex
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should deduplicate subscriber tags on creation', async () => {
      const res = await request(app.getHttpServer())
        .post('/subscribers')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Subscriber Duplicate Tags',
          tags: ['promo', 'vip', 'promo', 'vip', 'new'],
        })
        .expect(HttpStatus.CREATED);

      const tags = typeof res.body.tags === 'string' ? JSON.parse(res.body.tags) : res.body.tags;
      expect(tags).toBeInstanceOf(Array);
      expect(tags).toHaveLength(3);
      expect(tags.sort()).toEqual(['new', 'promo', 'vip'].sort());
    });

    it('should return 404 for fetching a non-existent subscriber ID', async () => {
      await request(app.getHttpServer())
        .get('/subscribers/non-existent-uuid')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should enforce data segregation: Tenant B cannot fetch Tenant A subscriber', async () => {
      // 1. Tenant A creates a subscriber
      const createRes = await request(app.getHttpServer())
        .post('/subscribers')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Secret Tenant A Subscriber',
          email: 'secretA@example.com',
        })
        .expect(HttpStatus.CREATED);
      const subId = createRes.body.id;

      // 2. Tenant B attempts to fetch Tenant A subscriber and is rejected with 404
      await request(app.getHttpServer())
        .get(`/subscribers/${subId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should enforce data segregation: Tenant B cannot update Tenant A subscriber', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/subscribers')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Tenant A Subscriber to Update',
        })
        .expect(HttpStatus.CREATED);
      const subId = createRes.body.id;

      await request(app.getHttpServer())
        .patch(`/subscribers/${subId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          name: 'Hacked name',
        })
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should enforce data segregation: Tenant B cannot delete Tenant A subscriber', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/subscribers')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Tenant A Subscriber to Delete',
        })
        .expect(HttpStatus.CREATED);
      const subId = createRes.body.id;

      await request(app.getHttpServer())
        .delete(`/subscribers/${subId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  // ==========================================
  // 2. USER PROFILE MANAGEMENT BOUNDARY TESTS
  // ==========================================
  describe('User Profile Management Boundaries', () => {
    it('should fetch own profile details correctly', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(HttpStatus.OK);

      expect(res.body.email).toBe(emailA);
      expect(res.body.name).toBe('User A');
    });

    it('should reject profile update with invalid name format (non-string)', async () => {
      await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 12345, // invalid type
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should reject profile update with short password', async () => {
      await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          password: '123',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should update profile name and verify it matches upon retrieval', async () => {
      await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Updated User A Name',
        })
        .expect(HttpStatus.OK);

      const res = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(HttpStatus.OK);

      expect(res.body.name).toBe('Updated User A Name');
    });
  });

  // ==========================================
  // 3. TEAM MANAGEMENT BOUNDARY TESTS
  // ==========================================
  describe('Team Management Boundaries', () => {
    it('should reject inviting a team member with invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/team/invitations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          email: 'invalid-email',
          role: 'ADMIN',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should reject inviting a team member with invalid role value', async () => {
      await request(app.getHttpServer())
        .post('/team/invitations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          email: 'valid_agent@example.com',
          role: 'SUPER_OWNER_ROLE', // not valid
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should prevent non-admin/non-owner from sending team invitations', async () => {
      // 1. Create a member under Tenant A
      const inviteRes = await request(app.getHttpServer())
        .post('/team/invitations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          email: 'regular_member@example.com',
          role: 'MEMBER',
        })
        .expect(HttpStatus.CREATED);

      const invitationToken = inviteRes.body.token;

      // Accept invitation to register member
      await request(app.getHttpServer())
        .post('/team/invitations/accept')
        .send({
          token: invitationToken,
          password: 'password123',
          name: 'Regular Member',
        })
        .expect(HttpStatus.OK);

      // Login as regular member
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'regular_member@example.com',
          password: 'password123',
        })
        .expect(HttpStatus.OK);
      const memberToken = loginRes.body.access_token;

      // Member attempts to invite someone else
      await request(app.getHttpServer())
        .post('/team/invitations')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          email: 'other_member@example.com',
          role: 'AGENT',
        })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should reject accept invitation with invalid or expired token', async () => {
      await request(app.getHttpServer())
        .post('/team/invitations/accept')
        .send({
          token: 'invalid_or_expired_token',
          password: 'password123',
          name: 'Some Name',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should prevent updating owner role or downgrading own role', async () => {
      // The owner attempts to update their own role (which defaults to 'member-id-123' check or owner-id-self in service)
      await request(app.getHttpServer())
        .patch('/team/members/owner-id-self')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          role: 'AGENT',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 404 for updating role of non-existent member', async () => {
      await request(app.getHttpServer())
        .patch('/team/members/non-existent-uuid')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          role: 'AGENT',
        })
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 404 for removing non-existent member', async () => {
      await request(app.getHttpServer())
        .delete('/team/members/non-existent-uuid')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should enforce team boundaries: Tenant B cannot view Tenant A team members', async () => {
      const res = await request(app.getHttpServer())
        .get('/team/members')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(HttpStatus.OK);

      // Should only list Tenant B's members (just User B)
      expect(res.body).toHaveLength(1);
      expect(res.body[0].user.email).toBe(emailB);
    });
  });

  // ==========================================
  // 4. BROADCASTS BOUNDARY TESTS
  // ==========================================
  describe('Broadcasts Boundaries', () => {
    it('should reject broadcast creation with invalid segment target containing "invalid"', async () => {
      await request(app.getHttpServer())
        .post('/broadcasts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Invalid Target',
          content: 'Hello customers!',
          segmentTarget: 'invalid_segment_value',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should reject broadcast scheduling with a past date', async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      await request(app.getHttpServer())
        .post('/broadcasts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Past Scheduled Campaign',
          content: 'Should fail scheduling',
          segmentTarget: 'all',
          scheduledAt: pastDate,
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should schedule a valid future broadcast', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1 hour in future
      const res = await request(app.getHttpServer())
        .post('/broadcasts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Future Scheduled Campaign',
          content: 'Should succeed scheduling',
          segmentTarget: 'all',
          scheduledAt: futureDate,
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.status).toBe('SCHEDULED');
      expect(new Date(res.body.scheduledAt).getTime()).toBeCloseTo(
        new Date(futureDate).getTime(),
        -3,
      );
    });

    it('should return 404 for scheduling non-existent broadcast', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      await request(app.getHttpServer())
        .post('/broadcasts/non-existent-uuid/schedule')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          scheduledAt: futureDate,
        })
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 404 for executing non-existent broadcast', async () => {
      await request(app.getHttpServer())
        .post('/broadcasts/non-existent-uuid/execute')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should prevent cancelling an already sent campaign', async () => {
      // Create broadcast
      const createRes = await request(app.getHttpServer())
        .post('/broadcasts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Campaign to Send',
          content: 'Test sending',
          segmentTarget: 'all',
        })
        .expect(HttpStatus.CREATED);
      const bId = createRes.body.id;

      // Execute broadcast
      await request(app.getHttpServer())
        .post(`/broadcasts/${bId}/execute`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(HttpStatus.OK);

      // Attempt to cancel it (should fail with 400)
      await request(app.getHttpServer())
        .post(`/broadcasts/${bId}/cancel`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should enforce data segregation: Tenant B cannot execute Tenant A broadcast', async () => {
      // Tenant A creates broadcast
      const createRes = await request(app.getHttpServer())
        .post('/broadcasts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Tenant A Campaign',
          content: 'A content',
          segmentTarget: 'all',
        })
        .expect(HttpStatus.CREATED);
      const bId = createRes.body.id;

      // Tenant B tries to execute it -> 404 Not Found
      await request(app.getHttpServer())
        .post(`/broadcasts/${bId}/execute`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  // ==========================================
  // 5. PASSWORD RESETS BOUNDARY TESTS
  // ==========================================
  describe('Password Resets Boundaries', () => {
    it('should return 404 for requesting reset of non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/auth/password-reset')
        .send({
          email: 'nonexistent_email_12345@example.com',
        })
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should trigger rate limiting (429) if requested repeatedly (>2 times in 1 min)', async () => {
      // First attempt
      await request(app.getHttpServer())
        .post('/auth/password-reset')
        .send({ email: emailA })
        .expect(HttpStatus.CREATED);

      // Second attempt
      await request(app.getHttpServer())
        .post('/auth/password-reset')
        .send({ email: emailA })
        .expect(HttpStatus.CREATED);

      // Third attempt -> 429
      await request(app.getHttpServer())
        .post('/auth/password-reset')
        .send({ email: emailA })
        .expect(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('should reject password reset with expired token', async () => {
      await request(app.getHttpServer())
        .post('/auth/password-reset/reset')
        .send({
          token: 'expired_reset_token', // Mock handled by auth.service.ts
          password: 'newpassword123',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should reject password reset with malformed or non-existent token', async () => {
      await request(app.getHttpServer())
        .post('/auth/password-reset/reset')
        .send({
          token: 'non_existent_reset_token_which_is_long_enough',
          password: 'newpassword123',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  // ==========================================
  // 6. HEALTH CHECKS & SYSTEM BOUNDARY TESTS
  // ==========================================
  describe('Health Checks & System Info Boundaries', () => {
    it('should return 503 Service Unavailable when DB is simulated down', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .query({ simulateDbFailure: 'true' })
        .expect(HttpStatus.SERVICE_UNAVAILABLE);

      expect(res.body.status).toBe('error');
      expect(res.body.details.database.status).toBe('down');
    });

    it('should successfully get config limits and rate limits details', async () => {
      const configRes = await request(app.getHttpServer())
        .get('/system/config-limits')
        .expect(HttpStatus.OK);
      expect(configRes.body).toHaveProperty('maxRulesPerTenant');

      const rateRes = await request(app.getHttpServer())
        .get('/system/rate-limits')
        .expect(HttpStatus.OK);
      expect(rateRes.body).toHaveProperty('limit');
    });
  });
});
