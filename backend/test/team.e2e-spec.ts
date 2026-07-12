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

describe('Team Management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let memberToken: string;

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

    const ownerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'owner@example.com',
        name: 'Workspace Owner',
        password: 'securepassword123',
        tenantName: 'My Enterprise Tenant',
      })
      .expect(201);
    ownerToken = ownerRes.body.access_token;
    const ownerTenantId = ownerRes.body.user.tenantId;

    const newUser = await prisma.user.create({
      data: {
        email: 'newagent@example.com',
        name: 'New Agent User',
        password: 'hashed_securepassword123',
      },
    });

    await prisma.tenantMember.create({
      data: {
        id: 'member-id-123',
        userId: newUser.id,
        tenantId: ownerTenantId,
        role: 'MEMBER',
      },
    });

    await prisma.teamInvitation.create({
      data: {
        token: 'valid_invitation_token_123',
        email: 'invitedagent@example.com',
        role: 'ADMIN',
        tenantId: ownerTenantId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        accepted: false,
      },
    });

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'member@example.com',
        name: 'Regular Member',
        password: 'securepassword123',
        tenantName: 'Another Tenant',
      })
      .expect(201);

    const memberRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'newagent@example.com',
        password: 'securepassword123',
      })
      .expect(200);
    memberToken = memberRes.body.access_token;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('Team Invitation & Management (Tier 1 - Expected/Mocked)', () => {
    it('should invite a team member by email (Tier 1)', async () => {
      await request(app.getHttpServer())
        .post('/team/invitations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'anothernewagent@example.com',
          role: 'ADMIN',
        })
        .expect(201);
    });

    it('should accept team invitation and register (Tier 1)', async () => {
      await request(app.getHttpServer())
        .post('/team/invitations/accept')
        .send({
          token: 'valid_invitation_token_123',
          password: 'newagentpassword123',
          name: 'New Agent',
        })
        .expect(200);
    });

    it('should retrieve list of team members (Tier 1)', async () => {
      const res = await request(app.getHttpServer())
        .get('/team/members')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      if (res.status === 200) {
        expect(res.body).toBeInstanceOf(Array);
      }
    });

    it('should update team member role (Tier 1)', async () => {
      await request(app.getHttpServer())
        .patch('/team/members/member-id-123')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          role: 'MEMBER',
        })
        .expect(200);
    });

    it('should revoke/delete team member (Tier 1)', async () => {
      await request(app.getHttpServer())
        .delete('/team/members/member-id-123')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });
  });

  describe('Team Boundaries & Failures (Tier 2 - Expected/Mocked)', () => {
    it('should return 400/409 when inviting already invited or registered team member (Tier 2)', async () => {
      await request(app.getHttpServer())
        .post('/team/invitations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'newagent@example.com',
          role: 'MEMBER',
        })
        .expect((res) => {
          expect([400, 409]).toContain(res.status);
        });
    });

    it('should return 400 when accepting invitation with invalid token (Tier 2)', async () => {
      await request(app.getHttpServer())
        .post('/team/invitations/accept')
        .send({
          token: 'invalid_or_expired_token',
          password: 'newagentpassword123',
          name: 'New Agent',
        })
        .expect(400);
    });

    it('should return 400 when updating team member to invalid role (Tier 2)', async () => {
      await request(app.getHttpServer())
        .patch('/team/members/member-id-123')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          role: 'SUPER_ADMIN_INVALID',
        })
        .expect(400);
    });

    it('should return 400 when owner attempts to downgrade their own role (Tier 2)', async () => {
      const ownerMember = await prisma.tenantMember.findFirst({
        where: { user: { email: 'owner@example.com' } },
      });
      expect(ownerMember).toBeDefined();

      await request(app.getHttpServer())
        .patch(`/team/members/${ownerMember.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          role: 'MEMBER',
        })
        .expect(400);
    });

    it('should return 403 when non-owner team member attempts to invite others (Tier 2)', async () => {
      await request(app.getHttpServer())
        .post('/team/invitations')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          email: 'anotheragent@example.com',
          role: 'MEMBER',
        })
        .expect(403);
    });
  });
});
