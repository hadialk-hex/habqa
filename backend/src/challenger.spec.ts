import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpException,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { SubscribersService } from './subscribers/subscribers.service';
import { TeamService } from './team/team.service';
import { BroadcastsService } from './broadcasts/broadcasts.service';
import { AuthService } from './auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { TenantRole } from './team/dto/team.dto';

describe('Empirical Challenger M3 Test Suite', () => {
  let appController: AppController;
  let subscribersService: SubscribersService;
  let teamService: TeamService;
  let broadcastsService: BroadcastsService;
  let authService: AuthService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn((promises) => Promise.all(promises)),
    subscriber: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tenantMember: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    teamInvitation: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    broadcast: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    revokedToken: {
      upsert: jest.fn(),
    },
    tenant: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    platformConnection: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    conversation: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    message: {
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mocked-jwt-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        SubscribersService,
        TeamService,
        BroadcastsService,
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    appController = module.get<AppController>(AppController);
    subscribersService = module.get<SubscribersService>(SubscribersService);
    teamService = module.get<TeamService>(TeamService);
    broadcastsService = module.get<BroadcastsService>(BroadcastsService);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  describe('1. Health and System Config', () => {
    it('GET /health - should return status ok when DB is healthy', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([1]);
      const res = await appController.getHealth();
      expect(res).toEqual({
        status: 'ok',
        details: { database: { status: 'up' } },
      });
    });

    it('GET /health - should throw 503 when DB is offline', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(
        new Error('Connection refused'),
      );
      await expect(appController.getHealth()).rejects.toThrow(HttpException);
      try {
        await appController.getHealth();
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(err.getResponse().details.database.status).toBe('down');
      }
    });

    it('GET /health?simulateDbFailure=true - should immediately throw 503', async () => {
      await expect(appController.getHealth('true')).rejects.toThrow(
        HttpException,
      );
      try {
        await appController.getHealth('true');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(err.getResponse().status).toBe('error');
      }
    });

    it('PUT /tenants/:id - should restrict update to the logged-in tenant only', async () => {
      mockPrismaService.tenant.update.mockResolvedValue({
        id: 't-123',
        name: 'New Name',
      });
      const req = { user: { tenantId: 't-123', role: 'OWNER' } };
      const res = await appController.updateTenant(req, 't-123', {
        name: 'New Name',
      });
      expect(res.name).toBe('New Name');

      const unauthorizedReq = { user: { tenantId: 't-999', role: 'OWNER' } };
      await expect(
        appController.updateTenant(unauthorizedReq, 't-123', {
          name: 'New Name',
        }),
      ).rejects.toThrow(ForbiddenException);

      // Only OWNER/ADMIN may rename the workspace
      const lowRoleReq = { user: { tenantId: 't-123', role: 'VIEWER' } };
      await expect(
        appController.updateTenant(lowRoleReq, 't-123', {
          name: 'New Name',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('2. Subscribers Module', () => {
    it('create - should format tags correctly', async () => {
      mockPrismaService.subscriber.create.mockImplementation(({ data }) => {
        return Promise.resolve({ id: 'sub-1', ...data });
      });

      const dto = {
        name: 'John Doe',
        phone: '+12345678',
        email: 'john@example.com',
        tags: ['vip', 'vip', 'lead'],
        notes: 'Some note',
      };
      const res = await subscribersService.create('tenant-1', dto);

      expect(res.name).toBe('John Doe');
      expect(res.tags).toEqual(['vip', 'lead']); // duplicates removed
      expect(mockPrismaService.subscriber.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          name: 'John Doe',
          phone: '+12345678',
          email: 'john@example.com',
          tags: ['vip', 'lead'],
          notes: 'Some note',
          platform: null,
        },
      });
    });

    it('findOne - should return subscriber or throw NotFound', async () => {
      mockPrismaService.subscriber.findUnique.mockResolvedValue(null);
      await expect(
        subscribersService.findOne('tenant-1', 'invalid-id'),
      ).rejects.toThrow(NotFoundException);

      mockPrismaService.subscriber.findUnique.mockResolvedValue({
        id: 'subscriber-id-123',
        tenantId: 'tenant-1',
        name: 'Manual Sub',
        tags: ['promo'],
      });
      const res = await subscribersService.findOne(
        'tenant-1',
        'subscriber-id-123',
      );
      expect(res.id).toBe('subscriber-id-123');
      expect(res.tags).toEqual(['promo']);
    });
  });

  describe('3. Team Management Module', () => {
    it('inviteMember - should prevent non-owner/non-admin from inviting', async () => {
      const dto = { email: 'test@example.com', role: TenantRole.MEMBER };
      await expect(
        teamService.inviteMember('tenant-1', TenantRole.AGENT, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('inviteMember - should reject duplicates (already member or invited)', async () => {
      const dto = { email: 'test@example.com', role: TenantRole.MEMBER };

      // Duplicate member
      mockPrismaService.tenantMember.findFirst.mockResolvedValue({ id: 'm-1' });
      await expect(
        teamService.inviteMember('tenant-1', TenantRole.OWNER, dto),
      ).rejects.toThrow(ConflictException);

      // Duplicate invitation
      mockPrismaService.tenantMember.findFirst.mockResolvedValue(null);
      mockPrismaService.teamInvitation.findFirst.mockResolvedValue({
        id: 'inv-1',
      });
      await expect(
        teamService.inviteMember('tenant-1', TenantRole.OWNER, dto),
      ).rejects.toThrow(ConflictException);
    });

    it('acceptInvitation - should handle invalid token and real tokens', async () => {
      mockPrismaService.teamInvitation.findUnique.mockResolvedValue(null);
      await expect(
        teamService.acceptInvitation({
          token: 'invalid_or_expired_token',
          password: 'password123',
          name: 'Agent',
        }),
      ).rejects.toThrow(BadRequestException);

      // Valid token path
      mockPrismaService.teamInvitation.findUnique.mockResolvedValue({
        id: 'inv-123',
        tenantId: 'tenant-123',
        email: 'newagent@example.com',
        role: TenantRole.ADMIN,
        expiresAt: new Date(Date.now() + 3600000),
        accepted: false,
      });
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'u-1',
        email: 'newagent@example.com',
      });
      mockPrismaService.tenantMember.findFirst.mockResolvedValue(null);
      mockPrismaService.tenantMember.create.mockResolvedValue({ id: 'm-1' });
      mockPrismaService.teamInvitation.update.mockResolvedValue({});

      const res = await teamService.acceptInvitation({
        token: 'valid_token',
        password: 'password123',
        name: 'Agent',
      });
      expect(res.message).toBe('Invitation accepted successfully');
    });

    it('updateMemberRole - should prevent non-owner/non-admin requester, or self role updates', async () => {
      const dto = { role: TenantRole.ADMIN };

      // Non-owner requester
      mockPrismaService.tenantMember.findFirst.mockResolvedValue({
        id: 'req-1',
        role: TenantRole.MEMBER,
      });
      await expect(
        teamService.updateMemberRole('tenant-1', 'user-1', 'member-1', dto),
      ).rejects.toThrow(ForbiddenException);

      // Owner requester, updating own role
      mockPrismaService.tenantMember.findFirst.mockResolvedValue({
        id: 'owner-self',
        userId: 'user-owner',
        role: TenantRole.OWNER,
      });
      mockPrismaService.tenantMember.findUnique.mockResolvedValue({
        id: 'owner-self',
        userId: 'user-owner',
        role: TenantRole.OWNER,
        tenantId: 'tenant-1',
      });
      await expect(
        teamService.updateMemberRole(
          'tenant-1',
          'user-owner',
          'owner-self',
          dto,
        ),
      ).rejects.toThrow(BadRequestException);

      // Owner requester, updating other member
      mockPrismaService.tenantMember.findFirst.mockResolvedValue({
        id: 'owner-self',
        userId: 'user-owner',
        role: TenantRole.OWNER,
      });
      mockPrismaService.tenantMember.findUnique.mockResolvedValue({
        id: 'member-2',
        userId: 'user-2',
        role: TenantRole.MEMBER,
        tenantId: 'tenant-1',
      });
      mockPrismaService.tenantMember.update.mockResolvedValue({
        id: 'member-2',
        role: TenantRole.ADMIN,
      });
      const res = await teamService.updateMemberRole(
        'tenant-1',
        'user-owner',
        'member-2',
        dto,
      );
      expect(res.role).toBe(TenantRole.ADMIN);
    });
  });

  describe('4. Broadcasts Module', () => {
    it('create - should reject scheduled times in the past', async () => {
      const pastTime = new Date(Date.now() - 3600000).toISOString();
      const dto = {
        name: 'Past Broadcast',
        content: 'test',
        segmentTarget: 'all',
        scheduledAt: pastTime,
      };
      await expect(broadcastsService.create('tenant-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('execute - should send via existing connection and reject when none is linked', async () => {
      mockPrismaService.broadcast.findFirst.mockResolvedValue({
        id: 'b-1',
        content: 'Hello World',
        segmentTarget: 'all',
      });
      mockPrismaService.subscriber.findMany.mockResolvedValue([
        { id: 'sub-1', name: 'Sub 1', phone: '+1234' },
      ]);
      mockPrismaService.conversation.findFirst.mockResolvedValue(null);
      mockPrismaService.platformConnection.findFirst.mockResolvedValue({
        id: 'conn-1',
      });
      mockPrismaService.conversation.create.mockResolvedValue({ id: 'conv-1' });
      mockPrismaService.message.create.mockResolvedValue({});
      mockPrismaService.broadcast.update.mockResolvedValue({
        id: 'b-1',
        status: 'SENT',
        sentCount: 1,
      });

      const res = await broadcastsService.execute('tenant-1', 'b-1');
      expect(res.status).toBe('SENT');

      // Without a linked channel, execute must fail loudly instead of
      // fabricating a mock connection (old behavior polluted production data)
      mockPrismaService.platformConnection.findFirst.mockResolvedValue(null);
      await expect(
        broadcastsService.execute('tenant-1', 'b-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('cancel - should throw on already sent/cancelled campaigns or non-existent ones', async () => {
      // Non-existent
      mockPrismaService.broadcast.findFirst.mockResolvedValue(null);
      await expect(
        broadcastsService.cancel('tenant-1', 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);

      // Already SENT
      mockPrismaService.broadcast.findFirst.mockResolvedValue({
        id: 'b-sent',
        status: 'SENT',
      });
      await expect(
        broadcastsService.cancel('tenant-1', 'b-sent'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('5. Auth & Password Reset Module', () => {
    it('requestPasswordReset - should throttle requests (max 2 within 1 min)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'test@example.com',
      });
      mockPrismaService.passwordResetToken.upsert.mockResolvedValue({});

      // Request 1 & 2
      await authService.requestPasswordReset('test@example.com');
      await authService.requestPasswordReset('test@example.com');

      // Request 3 should throw TOO_MANY_REQUESTS
      await expect(
        authService.requestPasswordReset('test@example.com'),
      ).rejects.toThrow(HttpException);
    });

    it('resetPassword - should throw if token expired or invalid', async () => {
      mockPrismaService.passwordResetToken.findUnique.mockResolvedValue({
        id: 't-1',
        token: 'expired_token',
        expiresAt: new Date(Date.now() - 10000), // past
        usedAt: null,
      });

      await expect(
        authService.resetPassword({
          token: 'expired_token',
          password: 'newpassword123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
