import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase, seedDefaultTenant } from './db-cleanup';
import { ChannelsService } from '../src/channels/channels.service';
import * as crypto from 'crypto';
import { ThrottlerGuard } from '@nestjs/throttler';

jest.setTimeout(30000);

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockImplementation((pwd) => Promise.resolve(`hashed_${pwd}`)),
  compare: jest
    .fn()
    .mockImplementation((pwd, hash) =>
      Promise.resolve(hash === `hashed_${pwd}`),
    ),
}));

const mockConnections: any[] = [];
const mockUsers: any[] = [];
const mockTenants: any[] = [];
const mockMembers: any[] = [];

const mockPrismaService = {
  onModuleInit: jest.fn(),
  onModuleDestroy: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn().mockImplementation(async (cb) => {
    if (typeof cb === 'function') {
      return cb(mockPrismaService);
    }
    return cb;
  }),
  $executeRawUnsafe: jest.fn().mockImplementation(async (query) => {
    if (query.includes('DELETE') || query.includes('TRUNCATE')) {
      mockConnections.length = 0;
      mockUsers.length = 0;
      mockTenants.length = 0;
      mockMembers.length = 0;
    }
  }),
  platformConnection: {
    findMany: jest.fn().mockImplementation(async (args) => {
      const tenantId = args?.where?.tenantId;
      return mockConnections.filter((c) => c.tenantId === tenantId);
    }),
    findFirst: jest.fn().mockImplementation(async (args) => {
      const { platform, platformId, tenantId, id } = args?.where || {};
      return (
        mockConnections.find((c) => {
          if (id && c.id !== id) return false;
          if (tenantId && c.tenantId !== tenantId) return false;
          if (platform && c.platform !== platform) return false;
          if (platformId && c.platformId !== platformId) return false;
          return true;
        }) || null
      );
    }),
    findUnique: jest.fn().mockImplementation(async (args) => {
      const { id } = args?.where || {};
      return mockConnections.find((c) => c.id === id) || null;
    }),
    create: jest.fn().mockImplementation(async (args) => {
      const { tenantId, platform, platformId, name, accessToken } =
        args?.data || {};
      const newConn = {
        id: `mock_conn_id_${Date.now()}_${Math.random()}`,
        tenantId,
        platform,
        platformId,
        name,
        accessToken,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockConnections.push(newConn);
      return newConn;
    }),
    update: jest.fn().mockImplementation(async (args) => {
      const { id } = args?.where || {};
      const index = mockConnections.findIndex((c) => c.id === id);
      if (index === -1) throw new Error('Not found');
      const updated = {
        ...mockConnections[index],
        ...args?.data,
        updatedAt: new Date(),
      };
      mockConnections[index] = updated;
      return updated;
    }),
    delete: jest.fn().mockImplementation(async (args) => {
      const { id } = args?.where || {};
      const index = mockConnections.findIndex((c) => c.id === id);
      if (index === -1) throw new Error('Not found');
      const deleted = mockConnections[index];
      mockConnections.splice(index, 1);
      return deleted;
    }),
  },
  tenant: {
    upsert: jest.fn().mockImplementation(async (args) => {
      const { id } = args?.where || {};
      let tenant = mockTenants.find((t) => t.id === id);
      if (!tenant) {
        tenant = {
          id:
            id ||
            (crypto.randomUUID
              ? crypto.randomUUID()
              : '12345678-1234-1234-1234-1234567890ab'),
          name: args?.create?.name || 'Demo Tenant',
          plan: args?.create?.plan || 'ENTERPRISE',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockTenants.push(tenant);
      }
      return tenant;
    }),
    create: jest.fn().mockImplementation(async (args) => {
      const tenant = {
        id: crypto.randomUUID
          ? crypto.randomUUID()
          : '12345678-1234-1234-1234-1234567890ab',
        name: args?.data?.name,
        plan: args?.data?.plan || 'STARTER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockTenants.push(tenant);
      return tenant;
    }),
    findUnique: jest.fn().mockImplementation(async (args) => {
      const { id } = args?.where || {};
      return mockTenants.find((t) => t.id === id) || null;
    }),
  },
  user: {
    findUnique: jest.fn().mockImplementation(async (args) => {
      const { email, id } = args?.where || {};
      const user = mockUsers.find((u) => {
        if (email && u.email !== email) return false;
        if (id && u.id !== id) return false;
        return true;
      });
      if (!user) return null;
      const userMemberships = mockMembers.filter((m) => m.userId === user.id);
      return {
        ...user,
        memberships: userMemberships.map((m) => {
          if (!m.tenant) {
            m.tenant = mockTenants.find((t) => t.id === m.tenantId) || {
              id: m.tenantId,
              name: 'Demo Tenant',
              plan: 'STARTER',
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }
          return m;
        }),
      };
    }),
    create: jest.fn().mockImplementation(async (args) => {
      const user = {
        id: `mock_user_id_${Date.now()}_${Math.random()}`,
        email: args?.data?.email,
        name: args?.data?.name,
        password: args?.data?.password,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUsers.push(user);

      // Handle memberships creation
      const membershipsData = args?.data?.memberships?.create;
      if (membershipsData) {
        const createMemberships = Array.isArray(membershipsData)
          ? membershipsData
          : [membershipsData];
        for (const entry of createMemberships) {
          let tenantId = entry.tenantId;
          let tenant = null;
          if (entry.tenant?.create) {
            tenant = {
              id: crypto.randomUUID
                ? crypto.randomUUID()
                : '12345678-1234-1234-1234-1234567890ab',
              name: entry.tenant.create.name,
              plan: entry.tenant.create.plan || 'STARTER',
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockTenants.push(tenant);
            tenantId = tenant.id;
          } else if (entry.tenantId) {
            tenant = mockTenants.find((t) => t.id === entry.tenantId) || {
              id: entry.tenantId,
              name: 'Associated Tenant',
              plan: 'STARTER',
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            tenantId = tenant.id;
          } else {
            tenant = {
              id: crypto.randomUUID
                ? crypto.randomUUID()
                : '12345678-1234-1234-1234-1234567890ab',
              name: 'Default Tenant',
              plan: 'STARTER',
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockTenants.push(tenant);
            tenantId = tenant.id;
          }

          const member = {
            id: `mock_member_id_${Date.now()}_${Math.random()}`,
            tenantId,
            userId: user.id,
            role: entry.role || 'OWNER',
            tenant,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockMembers.push(member);
        }
      }

      const userMemberships = mockMembers.filter((m) => m.userId === user.id);
      return {
        ...user,
        memberships: userMemberships,
      };
    }),
  },
  tenantMember: {
    create: jest.fn().mockImplementation(async (args) => {
      const member = {
        id: `mock_member_id_${Date.now()}_${Math.random()}`,
        tenantId: args?.data?.tenantId,
        userId: args?.data?.userId,
        role: args?.data?.role || 'OWNER',
        tenant: mockTenants.find((t) => t.id === args?.data?.tenantId) || {
          id: args?.data?.tenantId,
          name: 'Demo Tenant',
          plan: 'STARTER',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMembers.push(member);
      return member;
    }),
    findFirst: jest.fn().mockImplementation(async (args) => {
      const { userId, tenantId } = args?.where || {};
      const member = mockMembers.find(
        (m) => m.userId === userId && m.tenantId === tenantId,
      );
      if (!member) return null;
      if (!member.tenant) {
        member.tenant = mockTenants.find((t) => t.id === member.tenantId) || {
          id: member.tenantId,
          name: 'Demo Tenant',
          plan: 'STARTER',
          isSuspended: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      return member;
    }),
  },
  revokedToken: {
    findUnique: jest.fn().mockImplementation(async () => null),
    create: jest.fn().mockImplementation(async (args) => args.data),
  },
  autoReplyRule: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
};

describe('Channel Connections (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

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
        email: 'channelowner@example.com',
        name: 'Channel Owner',
        password: 'securepassword123',
        tenantName: 'Channel Tenant',
      })
      .expect(201);

    token = res.body.access_token;
    tenantId = res.body.user.tenantId;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('GET /channels', () => {
    it('should fetch list of connected channels (Tier 1)', async () => {
      await prisma.platformConnection.create({
        data: {
          tenantId,
          platform: 'FACEBOOK_PAGE',
          platformId: 'page_123',
          name: 'My Facebook Page',
          accessToken: 'valid_access_token',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/channels')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(1);
      expect(res.body[0]).toHaveProperty('platformId', 'page_123');
    });
  });

  describe('POST /channels', () => {
    it('should save a channel connection successfully (Tier 1)', async () => {
      const res = await request(app.getHttpServer())
        .post('/channels')
        .set('Authorization', `Bearer ${token}`)
        .send({
          platform: 'FACEBOOK_PAGE',
          platformId: 'page_456',
          name: 'New FB Page',
          accessToken: 'new_token',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.platformId).toBe('page_456');
    });

    it('should return 400 when connecting channel with empty Page ID (Tier 2)', async () => {
      await request(app.getHttpServer())
        .post('/channels')
        .set('Authorization', `Bearer ${token}`)
        .send({
          platform: 'FACEBOOK_PAGE',
          platformId: '',
          name: 'Invalid Page',
        })
        .expect(400);
    });

    it('should return 400 when connecting channel with expired Facebook access token (Tier 2)', async () => {
      await request(app.getHttpServer())
        .post('/channels')
        .set('Authorization', `Bearer ${token}`)
        .send({
          platform: 'FACEBOOK_PAGE',
          platformId: 'page_invalid_token',
          name: 'Invalid Page',
          accessToken: 'expired_or_invalid',
        })
        .expect(400);
    });

    it('should return 409/400 when connecting already connected Facebook Page (Tier 2)', async () => {
      const connectionData = {
        platform: 'FACEBOOK_PAGE',
        platformId: 'page_dup',
        name: 'Duplicate Page',
      };

      await request(app.getHttpServer())
        .post('/channels')
        .set('Authorization', `Bearer ${token}`)
        .send(connectionData)
        .expect(201);

      await request(app.getHttpServer())
        .post('/channels')
        .set('Authorization', `Bearer ${token}`)
        .send(connectionData)
        .expect((res) => {
          expect([400, 409]).toContain(res.status);
        });
    });
  });

  describe('DELETE /channels/:id', () => {
    it('should delete a connected channel successfully (Tier 1)', async () => {
      const conn = await prisma.platformConnection.create({
        data: {
          tenantId,
          platform: 'FACEBOOK_PAGE',
          platformId: 'page_delete',
          name: 'Page to Delete',
        },
      });

      await request(app.getHttpServer())
        .delete(`/channels/${conn.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const check = await prisma.platformConnection.findUnique({
        where: { id: conn.id },
      });
      expect(check).toBeNull();
    });

    it('should return 404 when deleting a non-existent channel (Tier 2)', async () => {
      await request(app.getHttpServer())
        .delete('/channels/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('Channel Details & Updates (Tier 1 & 2 - Expected/Mocked)', () => {
    let connId: string;

    beforeEach(async () => {
      const conn = await prisma.platformConnection.create({
        data: {
          tenantId,
          platform: 'FACEBOOK_PAGE',
          platformId: 'page_details',
          name: 'Details Page',
        },
      });
      connId = conn.id;
    });

    it('should retrieve channel details (Tier 1)', async () => {
      const mockFetch = jest
        .spyOn(global, 'fetch')
        .mockImplementation((_url: any) => {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: 'page_details',
                name: 'Details Page',
                about: 'Facebook Page About',
                picture: { data: { url: 'pic_url' } },
                fan_count: 100,
              }),
          } as any);
        });

      try {
        const res = await request(app.getHttpServer())
          .get(`/channels/${connId}/details`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(res.body).toHaveProperty('id', 'page_details');
        expect(res.body).toHaveProperty('name', 'Details Page');
      } finally {
        mockFetch.mockRestore();
      }
    });

    it('should successfully update a channel connection name using PUT (Tier 1)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/channels/${connId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Details Page Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Details Page Name');

      const conn = await prisma.platformConnection.findUnique({
        where: { id: connId },
      });
      expect(conn!.name).toBe('Updated Details Page Name');
    });

    it('should return 400 when updating connection name with empty string (Tier 2)', async () => {
      await request(app.getHttpServer())
        .put(`/channels/${connId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' })
        .expect(400);
    });

    it('should return 404 when attempting to edit a non-existent channel (Tier 2)', async () => {
      await request(app.getHttpServer())
        .put('/channels/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated name' })
        .expect(404);
    });

    it('should retrieve page details with malformed token handling error gracefully (Tier 2)', async () => {
      const mockFetch = jest
        .spyOn(global, 'fetch')
        .mockImplementation((_url: any) => {
          return Promise.resolve({
            ok: false,
            json: () =>
              Promise.resolve({
                error: {
                  message: 'Malformed access token',
                  type: 'OAuthException',
                  code: 190,
                },
              }),
          } as any);
        });

      try {
        await request(app.getHttpServer())
          .get(`/channels/${connId}/details`)
          .set('Authorization', `Bearer ${token}`)
          .query({ token: 'malformed' })
          .expect(400);
      } finally {
        mockFetch.mockRestore();
      }
    });
  });

  describe('Cross-Tenant Channel Hijacking Prevention', () => {
    it('should prevent connecting a page that is already connected to another tenant', async () => {
      await prisma.platformConnection.create({
        data: {
          tenantId: 'some-other-tenant-id',
          platform: 'FACEBOOK_PAGE',
          platformId: 'shared_page_id',
          name: 'Other Tenant Page',
        },
      });

      await request(app.getHttpServer())
        .post('/channels')
        .set('Authorization', `Bearer ${token}`)
        .send({
          platform: 'FACEBOOK_PAGE',
          platformId: 'shared_page_id',
          name: 'My Attempted Hijack Page',
          accessToken: 'some_access_token',
        })
        .expect(409);
    });
  });

  describe('OAuth State Signature Validation', () => {
    it('should succeed when callback is called with a correctly signed state', async () => {
      const mockFetch = jest
        .spyOn(global, 'fetch')
        .mockImplementation((url: any) => {
          if (url.toString().includes('oauth/access_token')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({ access_token: 'mocked_user_access_token' }),
            } as any);
          }
          if (url.toString().includes('me/accounts')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  data: [
                    {
                      id: 'mock_page_id_state_sig',
                      name: 'FB OAuth State Sig Page',
                      access_token: 'super_secret_fb_page_token_sig',
                    },
                  ],
                }),
            } as any);
          }
          return Promise.resolve({ ok: false } as any);
        });

      try {
        const channelsService = app.get(ChannelsService);
        const signedState = channelsService.generateOAuthState(tenantId);

        await request(app.getHttpServer())
          .get('/channels/facebook/callback')
          .query({ code: 'valid_code', state: signedState })
          .expect(200);
      } finally {
        mockFetch.mockRestore();
      }
    });

    it('should fail with 400 when state signature is invalid', async () => {
      await request(app.getHttpServer())
        .get('/channels/facebook/callback')
        .query({ code: 'valid_code', state: 'invalid-state-signature-value' })
        .expect(400);
    });

    it('should fail with 400 when state is missing', async () => {
      await request(app.getHttpServer())
        .get('/channels/facebook/callback')
        .query({ code: 'valid_code' })
        .expect(400);
    });
  });

  describe('Facebook OAuth Callback (Tier 1 - Expected/Mocked)', () => {
    it('should handle Facebook OAuth callback with state (tenantId) and store encrypted credentials', async () => {
      const mockFetch = jest
        .spyOn(global, 'fetch')
        .mockImplementation((url: any) => {
          if (url.toString().includes('oauth/access_token')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({ access_token: 'mocked_user_access_token' }),
            } as any);
          }
          if (url.toString().includes('me/accounts')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  data: [
                    {
                      id: 'mock_page_id_fb_oauth',
                      name: 'FB OAuth Mock Page',
                      access_token: 'super_secret_fb_page_token',
                    },
                  ],
                }),
            } as any);
          }
          return Promise.resolve({ ok: false } as any);
        });

      try {
        const channelsService = app.get(ChannelsService);
        const signedState = channelsService.generateOAuthState(tenantId);

        await request(app.getHttpServer())
          .get('/channels/facebook/callback')
          .query({ code: 'fb_oauth_test_code', state: signedState })
          .expect(200);

        // Verify the connection is saved in the database
        const connection = await prisma.platformConnection.findFirst({
          where: { platformId: 'mock_page_id_fb_oauth' },
        });

        expect(connection).toBeDefined();
        expect(connection).not.toBeNull();
        expect(connection!.name).toBe('FB OAuth Mock Page');
        expect(connection!.platform).toBe('FACEBOOK_PAGE');
        expect(connection!.tenantId).toBe(tenantId);

        // Verify token is encrypted in the DB
        expect(connection!.accessToken).not.toBe('super_secret_fb_page_token');
        expect(connection!.accessToken).toContain(':');

        // Verify decryption retrieves the correct original token
        const decrypted = channelsService.getDecryptedAccessToken(
          connection!.accessToken!,
        );
        expect(decrypted).toBe('super_secret_fb_page_token');
      } finally {
        mockFetch.mockRestore();
      }
    });
  });
});
