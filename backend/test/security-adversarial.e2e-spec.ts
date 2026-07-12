import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
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

describe('Security & Privilege Escalation Adversarial Tests (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Tenant A / Owner A
  let tokenOwnerA: string;
  let userOwnerAId: string;
  let tenantAId: string;

  // Tenant B / Owner B
  let tokenOwnerB: string;
  let tenantBId: string;

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

    // Register Owner A
    const resA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'ownera@example.com',
        name: 'Owner A',
        password: 'password123',
        tenantName: 'Tenant A',
      })
      .expect(HttpStatus.CREATED);
    tokenOwnerA = resA.body.access_token;
    userOwnerAId = resA.body.user.id;
    tenantAId = resA.body.user.tenantId;

    // Register Owner B
    const resB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'ownerb@example.com',
        name: 'Owner B',
        password: 'password123',
        tenantName: 'Tenant B',
      })
      .expect(HttpStatus.CREATED);
    tokenOwnerB = resB.body.access_token;
    tenantBId = resB.body.user.tenantId;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('JWT Stateless Trust & Membership Revocation Vulnerabilities', () => {
    it('VULNERABILITY: Downgraded/deleted admin can still invite members using unexpired JWT', async () => {
      // 1. Owner A invites User B as ADMIN to Tenant A
      const inviteRes = await request(app.getHttpServer())
        .post('/team/invitations')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          email: 'userb_admin@example.com',
          role: 'ADMIN',
        })
        .expect(HttpStatus.CREATED);

      const token = inviteRes.body.token;

      // 2. User B accepts the invitation and registers
      await request(app.getHttpServer())
        .post('/team/invitations/accept')
        .send({
          token: token,
          password: 'password123',
          name: 'User B Admin',
        })
        .expect(HttpStatus.OK);

      // 3. User B logs in and gets their JWT token
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'userb_admin@example.com',
          password: 'password123',
        })
        .expect(HttpStatus.OK);
      const tokenUserB = loginRes.body.access_token;
      const userBId = loginRes.body.user.id;

      // Verify that User B can initially invite someone
      const testInviteRes = await request(app.getHttpServer())
        .post('/team/invitations')
        .set('Authorization', `Bearer ${tokenUserB}`)
        .send({
          email: 'test_invitee_1@example.com',
          role: 'MEMBER',
        })
        .expect(HttpStatus.CREATED);

      // 4. Owner A deletes User B from Tenant A's membership in the database
      const memberRecord = await prisma.tenantMember.findFirst({
        where: { tenantId: tenantAId, userId: userBId },
      });
      expect(memberRecord).not.toBeNull();

      await request(app.getHttpServer())
        .delete(`/team/members/${memberRecord!.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .expect(HttpStatus.OK);

      // 5. User B attempts to use their original unexpired JWT token to invite another user
      // EXPECTED SECURITY POLICY: User B's membership was revoked, request must be rejected with 401/403.
      // CURRENT CODE: Trusts req.user.role/tenantId directly from the JWT.
      const hackInviteRes = await request(app.getHttpServer())
        .post('/team/invitations')
        .set('Authorization', `Bearer ${tokenUserB}`)
        .send({
          email: 'test_invitee_2@example.com',
          role: 'MEMBER',
        });

      // Assert current vulnerable behavior (should succeed 201 because of trust in JWT role)
      // Note: We flag this as vulnerable, but we document it.
      console.log(
        `[Adversarial Test] Revoked admin invitation status code: ${hackInviteRes.status}`,
      );
      expect(hackInviteRes.status).toBe(HttpStatus.CREATED); // Vulnerability confirmed!
    });

    it('VULNERABILITY: Revoked membership user can still read/write subscribers via unexpired JWT', async () => {
      // 1. Owner A invites User C as MEMBER to Tenant A
      const inviteRes = await request(app.getHttpServer())
        .post('/team/invitations')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          email: 'userc_member@example.com',
          role: 'MEMBER',
        })
        .expect(HttpStatus.CREATED);

      const token = inviteRes.body.token;

      // 2. User C accepts the invitation and registers
      await request(app.getHttpServer())
        .post('/team/invitations/accept')
        .send({
          token: token,
          password: 'password123',
          name: 'User C Member',
        })
        .expect(HttpStatus.OK);

      // 3. User C logs in and gets their JWT token
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'userc_member@example.com',
          password: 'password123',
        })
        .expect(HttpStatus.OK);
      const tokenUserC = loginRes.body.access_token;
      const userCId = loginRes.body.user.id;

      // 4. Owner A deletes User C's membership in the database
      const memberRecord = await prisma.tenantMember.findFirst({
        where: { tenantId: tenantAId, userId: userCId },
      });
      expect(memberRecord).not.toBeNull();

      await request(app.getHttpServer())
        .delete(`/team/members/${memberRecord!.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .expect(HttpStatus.OK);

      // 5. User C tries to list subscribers of Tenant A using their unexpired JWT
      // EXPECTED SECURITY POLICY: Must reject with 401/403.
      // CURRENT CODE: Filters by req.user.tenantId (Tenant A) from JWT, which still allows viewing.
      const subscribersRes = await request(app.getHttpServer())
        .get('/subscribers')
        .set('Authorization', `Bearer ${tokenUserC}`);

      console.log(
        `[Adversarial Test] Revoked member fetch subscribers status code: ${subscribersRes.status}`,
      );
      expect(subscribersRes.status).toBe(HttpStatus.OK); // Vulnerability confirmed!
    });
  });

  describe('Cross-Tenant Data Hijacking Vulnerabilities', () => {
    it('VULNERABILITY: Owner B can hijack and delete "member-id-123" belonging to Tenant A', async () => {
      // "member-id-123" is seeded under the default/demo tenant (Tenant A in this scenario, or here demo-tenant-id).
      // Owner B belongs to Tenant B.
      // Owner B attempts to delete member-id-123.
      // EXPECTED SECURITY POLICY: Owner B should get 403 Forbidden or 404 Not Found since member-id-123 is not in Tenant B.
      // CURRENT CODE: Inside team.service.ts, if memberId is "member-id-123" and tenantId does not match,
      // it UPDATES the member's tenantId to the requester's tenantId, stealing the resource, and then deletes it!

      // Let's verify this by checking that the request returns 200 OK (due to the bypass) instead of 404/403.
      const deleteRes = await request(app.getHttpServer())
        .delete('/team/members/member-id-123')
        .set('Authorization', `Bearer ${tokenOwnerB}`);

      console.log(
        `[Adversarial Test] Hijack and delete member-id-123 status code: ${deleteRes.status}`,
      );
      expect(deleteRes.status).toBe(HttpStatus.OK); // Vulnerability confirmed: it successfully hijacked and deleted it!
    });
  });
});
