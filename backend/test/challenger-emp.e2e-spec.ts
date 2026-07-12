import { Test, TestingModule } from '@nestjs/testing';
import { ChannelsController } from '../src/channels/channels.controller';
import { ChannelsService } from '../src/channels/channels.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

describe('Empirical Verification: Credentials & State Signature', () => {
  let channelsService: ChannelsService;
  let channelsController: ChannelsController;
  const originalEnvKey = process.env.ENCRYPTION_KEY;
  const originalAppSecret = process.env.APP_SECRET;

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
    process.env.APP_SECRET = 'test-app-secret-key';

    const mockPrisma = {
      platformConnection: {
        create: jest.fn().mockImplementation(async (args) => {
          return { id: 'mock-id', ...args.data };
        }),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [ChannelsController],
      providers: [
        ChannelsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    channelsService = module.get<ChannelsService>(ChannelsService);
    channelsController = module.get<ChannelsController>(ChannelsController);
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = originalEnvKey;
    process.env.APP_SECRET = originalAppSecret;
  });

  describe('Credentials Decryption Robustness', () => {
    it('throws error when ciphertext is malformed (no colon)', () => {
      expect(() => {
        channelsService.getDecryptedAccessToken('malformedText');
      }).toThrow(BadRequestException);
    });

    it('throws error when ciphertext has multiple colons', () => {
      expect(() => {
        channelsService.getDecryptedAccessToken('part1:part2:part3');
      }).toThrow(BadRequestException);
    });

    it('throws error when ENCRYPTION_KEY is missing during decryption', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => {
        channelsService.getDecryptedAccessToken('ivhex:cipherhex');
      }).toThrow();
      process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
    });

    it('throws error when WRONG key is used during decryption', () => {
      const originalToken = 'secret-token';
      const key = crypto
        .createHash('sha256')
        .update(process.env.ENCRYPTION_KEY!)
        .digest();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(originalToken, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const ciphertext = `${iv.toString('hex')}:${encrypted}`;

      // Change key
      process.env.ENCRYPTION_KEY = 'completely-different-encryption-key';

      expect(() => {
        channelsService.getDecryptedAccessToken(ciphertext);
      }).toThrow(BadRequestException);

      process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
    });
  });

  describe('OAuth State Signature Verification', () => {
    it('verifies correct state signature', () => {
      const tenantId = 'my-tenant-id';
      const stateObj = channelsService.generateOAuthState(tenantId);
      const verifiedTenantId = channelsService.verifyOAuthState(stateObj);
      expect(verifiedTenantId).toBe(tenantId);
    });

    it('rejects forged state signature format', () => {
      const tenantId = 'my-tenant-id';
      const forgedState = `${tenantId}.forgedsignaturehere`;
      const verifiedTenantId = channelsService.verifyOAuthState(forgedState);
      expect(verifiedTenantId).toBeNull();
    });

    it('rejects invalid state parameter format', () => {
      const verifiedTenantId =
        channelsService.verifyOAuthState('invalid-state');
      expect(verifiedTenantId).toBeNull();
    });

    it('successfully rejects raw UUID state parameter', async () => {
      const rawUUID = '12345678-1234-1234-1234-1234567890ab';
      await expect(
        channelsController.facebookCallback('auth_code', rawUUID),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully rejects demo-tenant-id state parameter', async () => {
      const demoState = 'demo-tenant-id';
      await expect(
        channelsController.facebookCallback('auth_code', demoState),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
