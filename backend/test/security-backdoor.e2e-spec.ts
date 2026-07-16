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

describe('Security Backdoor & Cross-Tenant Hijacking E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAToken: string;
  let _tenantAId: string;

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

    // Seed member-id-123 in demo-tenant-id
    const memberUser = await prisma.user.create({
      data: {
        email: 'newagent@example.com',
        name: 'Regular Member',
        password: 'hashed_securepassword123',
      },
    });

    await prisma.tenantMember.create({
      data: {
        id: 'member-id-123',
        userId: memberUser.id,
        tenantId: 'demo-tenant-id',
        role: 'MEMBER',
      },
    });

    // Register User A (Workspace Owner of Tenant A)
    const resA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'usera@example.com',
        name: 'User A',
        password: 'password123',
        tenantName: 'Tenant A',
      })
      .expect(HttpStatus.CREATED);

    tenantAToken = resA.body.access_token;
    _tenantAId = resA.body.user.tenantId;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  it('should REJECT Tenant A owner from modifying member-id-123 (which belongs to demo-tenant-id)', async () => {
    // 1. Verify member-id-123 is originally in demo-tenant-id
    const originalMember = await prisma.tenantMember.findUnique({
      where: { id: 'member-id-123' },
    });
    expect(originalMember).not.toBeNull();
    expect(originalMember!.tenantId).toBe('demo-tenant-id');

    // 2. Tenant A owner attempts to update the role of member-id-123.
    // This should fail with 403 Forbidden or 404 Not Found since member-id-123 is not in Tenant A.
    const patchRes = await request(app.getHttpServer())
      .patch('/team/members/member-id-123')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({
        role: 'AGENT',
      });

    // We assert that the request SHOULD fail, but we'll print what it actually returns to document the vulnerability.
    console.log(
      'PATCH /team/members/member-id-123 response status:',
      patchRes.status,
    );
    console.log(
      'PATCH /team/members/member-id-123 response body:',
      patchRes.body,
    );

    // Let's assert that it fails. If the backdoor is active, this assertion will fail because it returns 200 OK.
    expect(patchRes.status).not.toBe(HttpStatus.OK);
  });

  it('should REJECT Tenant A owner from deleting member-id-123 (which belongs to demo-tenant-id)', async () => {
    // 1. Tenant A owner attempts to delete member-id-123.
    // This should fail with 403 Forbidden or 404 Not Found.
    const deleteRes = await request(app.getHttpServer())
      .delete('/team/members/member-id-123')
      .set('Authorization', `Bearer ${tenantAToken}`);

    console.log(
      'DELETE /team/members/member-id-123 response status:',
      deleteRes.status,
    );
    console.log(
      'DELETE /team/members/member-id-123 response body:',
      deleteRes.body,
    );

    expect(deleteRes.status).not.toBe(HttpStatus.OK);
  });
});
