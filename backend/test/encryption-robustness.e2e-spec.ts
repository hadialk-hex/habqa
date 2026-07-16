import { Test, TestingModule } from '@nestjs/testing';
import { ChannelsService } from '../src/channels/channels.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

describe('Credentials Encryption/Decryption Robustness', () => {
  let channelsService: ChannelsService;
  let mockPrisma: any;
  const originalEnvKey = process.env.ENCRYPTION_KEY;

  beforeAll(async () => {
    // Reset key to a known test key
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';

    mockPrisma = {
      platformConnection: {
        create: jest.fn().mockImplementation(async (args) => {
          return { id: 'mock-id', ...args.data };
        }),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        ChannelsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    channelsService = module.get<ChannelsService>(ChannelsService);
  });

  afterAll(() => {
    // Restore original env key
    process.env.ENCRYPTION_KEY = originalEnvKey;
  });

  describe('Encryption Algorithm & Key Handling', () => {
    it('should successfully encrypt a token, store it, and decrypt it back to original value', async () => {
      const originalToken = 'secret-fb-access-token-xyz-123';

      // Simulate adding a connection
      await channelsService.addConnection('tenant-1', {
        platform: 'FACEBOOK_PAGE',
        platformId: 'page-123',
        name: 'Test Page',
        accessToken: originalToken,
      });

      // Retrieve the encrypted token sent to mockPrisma
      const createCalls = mockPrisma.platformConnection.create.mock.calls;
      const savedData = createCalls[createCalls.length - 1][0].data;
      const encryptedToken = savedData.accessToken;

      expect(encryptedToken).toBeDefined();
      expect(encryptedToken).not.toBeNull();
      expect(encryptedToken).not.toBe(originalToken);

      // Verify format is iv:ciphertext (separated by a single colon)
      const parts = encryptedToken.split(':');
      expect(parts.length).toBe(2);

      // Verify the IV is 16 bytes (32 hex characters)
      const ivHex = parts[0];
      expect(ivHex.length).toBe(32);

      // Decrypt using service method
      const decrypted = channelsService.getDecryptedAccessToken(encryptedToken);
      expect(decrypted).toBe(originalToken);
    });

    it('should use aes-256-cbc under the hood', () => {
      // We can verify that using standard crypto with aes-256-cbc and the key digests/recovers it
      const originalToken = 'secret-fb-access-token-xyz-123';

      const key = crypto
        .createHash('sha256')
        .update(process.env.ENCRYPTION_KEY!)
        .digest();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(originalToken, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const formattedCiphertext = `${iv.toString('hex')}:${encrypted}`;

      // Decrypt using ChannelsService
      const decrypted =
        channelsService.getDecryptedAccessToken(formattedCiphertext);
      expect(decrypted).toBe(originalToken);
    });

    it('should throw an unhandled exception during encryption if ENCRYPTION_KEY is missing', async () => {
      delete process.env.ENCRYPTION_KEY;

      await expect(
        channelsService.addConnection('tenant-1', {
          platform: 'FACEBOOK_PAGE',
          platformId: 'page-123',
          name: 'Test Page',
          accessToken: 'some-token',
        }),
      ).rejects.toThrow('ENCRYPTION_KEY environment variable is not defined');

      // Restore key
      process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
    });

    it('should throw BadRequestException on decryption failure if ENCRYPTION_KEY is missing', () => {
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

      // Remove the key
      delete process.env.ENCRYPTION_KEY;

      // When key is missing, decrypt fails and throws BadRequestException
      expect(() => channelsService.getDecryptedAccessToken(ciphertext)).toThrow(
        BadRequestException,
      );

      // Restore key
      process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
    });

    it('should throw BadRequestException on decryption failure if the key changes', () => {
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

      // Change the key
      process.env.ENCRYPTION_KEY = 'completely-different-key';

      // Decryption with wrong key should fail to verify padding or block format,
      // thus throwing BadRequestException
      expect(() => channelsService.getDecryptedAccessToken(ciphertext)).toThrow(
        BadRequestException,
      );

      // Restore key
      process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
    });

    it('should throw BadRequestException if the ciphertext does not contain a colon', () => {
      const plainText = 'nocolonhere';
      expect(() => channelsService.getDecryptedAccessToken(plainText)).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if the ciphertext has multiple colons', () => {
      const plainText = 'one:two:three';
      expect(() => channelsService.getDecryptedAccessToken(plainText)).toThrow(
        BadRequestException,
      );
    });
  });
});
