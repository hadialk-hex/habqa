import {
  Injectable,
  Optional,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

import { ConfigService } from '@nestjs/config';
import { getPlanLimits } from '../common/plan-limits';
import { PlatformSettingsService } from '../settings/platform-settings.service';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not defined');
  }
  return crypto.createHash('sha256').update(key).digest();
}

function encrypt(text: string | null | undefined): string | null | undefined {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(
  encryptedText: string | null | undefined,
): string | null | undefined {
  if (!encryptedText) return encryptedText;
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new BadRequestException('Malformed encrypted token');
  }
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    throw new BadRequestException('Decryption failed: ' + error.message);
  }
}

@Injectable()
export class ChannelsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Optional() private platformSettings?: PlatformSettingsService,
  ) {}

  // Throws when the tenant's plan doesn't allow another connection
  private async enforceConnectionLimit(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('مساحة العمل غير موجودة');
    }
    const limits = getPlanLimits(tenant.plan);
    if (limits.maxConnections === -1) return;

    const count = await this.prisma.platformConnection.count({
      where: { tenantId },
    });
    if (count >= limits.maxConnections) {
      throw new ForbiddenException(
        `وصلت للحد الأقصى من القنوات المسموح بها في خطتك (${limits.maxConnections}). قم بترقية اشتراكك لربط قنوات أكثر.`,
      );
    }
  }

  async getConnections(tenantId: string) {
    const connections = await this.prisma.platformConnection.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return connections.map((conn) => ({
      ...conn,
      accessToken: conn.accessToken ? '***' : null,
    }));
  }

  async getConnection(tenantId: string, id: string) {
    const conn = await this.prisma.platformConnection.findFirst({
      where: { id, tenantId },
    });
    if (!conn) {
      throw new NotFoundException('القناة غير موجودة');
    }
    return {
      ...conn,
      accessToken: conn.accessToken ? '***' : null,
    };
  }

  async addConnection(
    tenantId: string,
    data: {
      platform: any;
      platformId: string;
      name: string;
      accessToken?: string;
    },
  ) {
    const existing = await this.prisma.platformConnection.findFirst({
      where: {
        platform: data.platform,
        platformId: data.platformId,
      },
    });
    if (existing) {
      if (existing.tenantId !== tenantId) {
        throw new ConflictException(
          'Channel is already connected to another tenant',
        );
      }
      throw new ConflictException('Channel is already connected');
    }

    await this.enforceConnectionLimit(tenantId);

    const encryptedToken = data.accessToken
      ? encrypt(data.accessToken)
      : data.accessToken;
    const conn = await this.prisma.platformConnection.create({
      data: {
        tenantId,
        platform: data.platform,
        platformId: data.platformId,
        name: data.name,
        accessToken: encryptedToken,
      },
    });
    return {
      ...conn,
      accessToken: conn.accessToken ? '***' : null,
    };
  }

  async removeConnection(tenantId: string, id: string) {
    const conn = await this.prisma.platformConnection.findFirst({
      where: { id, tenantId },
    });

    if (!conn) {
      throw new NotFoundException('القناة غير موجودة');
    }

    await this.prisma.autoReplyRule.deleteMany({
      where: { connectionId: id, tenantId },
    });

    return this.prisma.platformConnection.delete({
      where: { id },
    });
  }

  async upsertConnection(
    tenantId: string,
    data: {
      platform: any;
      platformId: string;
      name: string;
      accessToken: string;
    },
  ) {
    const encryptedToken = encrypt(data.accessToken);

    const existing = await this.prisma.platformConnection.findFirst({
      where: {
        platform: data.platform,
        platformId: data.platformId,
      },
    });

    if (existing) {
      if (existing.tenantId !== tenantId) {
        throw new ConflictException(
          'Channel is already connected to another tenant',
        );
      }
      const updated = await this.prisma.platformConnection.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          accessToken: encryptedToken,
          tenantId,
        },
      });
      return {
        ...updated,
        accessToken: updated.accessToken ? '***' : null,
      };
    } else {
      await this.enforceConnectionLimit(tenantId);
      const created = await this.prisma.platformConnection.create({
        data: {
          tenantId,
          platform: data.platform,
          platformId: data.platformId,
          name: data.name,
          accessToken: encryptedToken,
        },
      });
      return {
        ...created,
        accessToken: created.accessToken ? '***' : null,
      };
    }
  }

  async handleFacebookCallback(tenantId: string, code: string) {
    const clientId =
      (await this.platformSettings?.get('FACEBOOK_APP_ID')) ||
      this.configService.get<string>('FACEBOOK_APP_ID') ||
      '';
    const clientSecret =
      (await this.platformSettings?.get('FACEBOOK_APP_SECRET')) ||
      this.configService.get<string>('FACEBOOK_APP_SECRET') ||
      this.configService.get<string>('APP_SECRET') ||
      '';
    const redirectUri =
      (await this.platformSettings?.get('FACEBOOK_REDIRECT_URI')) ||
      this.configService.get<string>('FACEBOOK_REDIRECT_URI') ||
      '';

    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${clientId}&redirect_uri=${redirectUri}&client_secret=${clientSecret}&code=${code}`;

    const tokenResponse = await fetch(tokenUrl);
    if (!tokenResponse.ok) {
      throw new BadRequestException('Failed to exchange Facebook auth code');
    }
    const tokenData: any = await tokenResponse.json();
    const userAccessToken = tokenData.access_token;
    if (!userAccessToken) {
      throw new BadRequestException('Facebook access token not returned');
    }

    const accountsUrl = `https://graph.facebook.com/v18.0/me/accounts?access_token=${userAccessToken}`;
    const accountsResponse = await fetch(accountsUrl);
    if (!accountsResponse.ok) {
      throw new BadRequestException('Failed to fetch Facebook pages');
    }
    const accountsData: any = await accountsResponse.json();

    let connected = 0;
    let skipped = 0;
    if (accountsData && accountsData.data && Array.isArray(accountsData.data)) {
      for (const page of accountsData.data) {
        try {
          await this.upsertConnection(tenantId, {
            platform: 'FACEBOOK_PAGE',
            platformId: page.id,
            name: page.name,
            accessToken: page.access_token,
          });

          // Subscribe the app to this page's webhook events
          try {
            const subscribeUrl = `https://graph.facebook.com/v18.0/${page.id}/subscribed_apps`;
            await fetch(subscribeUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                subscribed_fields: 'messages,messaging_postbacks,feed,message_reactions',
                access_token: page.access_token,
              }).toString(),
            });
          } catch (_) {
            // non-fatal: webhook subscription failure shouldn't block page connection
          }

          connected++;
        } catch (error) {
          // Plan limit reached or page owned by another tenant — skip the
          // remaining pages instead of failing the whole OAuth flow
          if (error instanceof ForbiddenException) {
            skipped = accountsData.data.length - connected;
            break;
          }
          if (error instanceof ConflictException) {
            skipped++;
            continue;
          }
          throw error;
        }
      }
    }
    return { connected, skipped };
  }

  // Instagram Business Login — standalone flow that does NOT require a
  // Facebook account or page. Exchanges the auth code for a long-lived
  // token and stores the professional account as an INSTAGRAM connection.
  async handleInstagramCallback(tenantId: string, code: string) {
    const clientId =
      (await this.platformSettings?.get('INSTAGRAM_APP_ID')) ||
      this.configService.get<string>('INSTAGRAM_APP_ID') ||
      '';
    const clientSecret =
      (await this.platformSettings?.get('INSTAGRAM_APP_SECRET')) ||
      this.configService.get<string>('INSTAGRAM_APP_SECRET') ||
      '';
    const redirectUri =
      (await this.platformSettings?.get('INSTAGRAM_REDIRECT_URI')) ||
      this.configService.get<string>('INSTAGRAM_REDIRECT_URI') ||
      '';

    // 1) Exchange the code for a short-lived token
    const form = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    });
    const tokenResponse = await fetch(
      'https://api.instagram.com/oauth/access_token',
      { method: 'POST', body: form },
    );
    if (!tokenResponse.ok) {
      throw new BadRequestException('Failed to exchange Instagram auth code');
    }
    const tokenData: any = await tokenResponse.json();
    const shortToken = tokenData.access_token;
    if (!shortToken) {
      throw new BadRequestException('Instagram access token not returned');
    }

    // 2) Upgrade to a 60-day long-lived token (falls back to the short one)
    let accessToken = shortToken;
    const longResponse = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(clientSecret)}&access_token=${encodeURIComponent(shortToken)}`,
    );
    if (longResponse.ok) {
      const longData: any = await longResponse.json();
      if (longData.access_token) accessToken = longData.access_token;
    }

    // 3) Fetch the professional account's id + username
    const meResponse = await fetch(
      `https://graph.instagram.com/me?fields=user_id,username&access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!meResponse.ok) {
      throw new BadRequestException('Failed to fetch Instagram account');
    }
    const me: any = await meResponse.json();
    const igUserId = String(me.user_id || tokenData.user_id || '');
    if (!igUserId) {
      throw new BadRequestException('Instagram account id not returned');
    }

    await this.upsertConnection(tenantId, {
      platform: 'INSTAGRAM',
      platformId: igUserId,
      name: me.username ? `@${me.username}` : 'Instagram',
      accessToken,
    });
    return { connected: 1, skipped: 0, username: me.username || null };
  }

  getDecryptedAccessToken(encryptedText: string): string {
    const result = decrypt(encryptedText);
    return result || '';
  }

  async getChannelDetails(tenantId: string, id: string, customToken?: string) {
    const conn = await this.prisma.platformConnection.findFirst({
      where: { id, tenantId },
    });
    if (!conn) {
      throw new NotFoundException('القناة غير موجودة');
    }

    let token = customToken;
    if (!token) {
      if (conn.accessToken) {
        token = this.getDecryptedAccessToken(conn.accessToken);
      }
    }

    if (!token) {
      throw new BadRequestException('Access token is missing');
    }

    const url = `https://graph.facebook.com/v19.0/${conn.platformId}?fields=name,about,picture,fan_count&access_token=${token}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch (e) {
          // ignore
        }
        const message =
          errorData?.error?.message || 'Facebook Graph API request failed';
        throw new BadRequestException(message);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Facebook Graph API request failed',
      );
    }
  }

  async getChannelPosts(
    tenantId: string,
    id: string,
    after?: string,
    limit = 12,
  ) {
    const conn = await this.prisma.platformConnection.findFirst({
      where: { id, tenantId },
    });
    if (!conn) {
      throw new NotFoundException('القناة غير موجودة');
    }
    if (!conn.accessToken) {
      throw new BadRequestException(
        'لا يوجد توكن وصول لهذه القناة. أعد ربط القناة عبر فيسبوك أولاً.',
      );
    }

    const token = this.getDecryptedAccessToken(conn.accessToken);
    const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 25);

    let url: string;
    if (conn.platform === 'INSTAGRAM') {
      const fields =
        'id,caption,media_type,media_url,thumbnail_url,timestamp,permalink,comments_count';
      url = `https://graph.facebook.com/v19.0/${conn.platformId}/media?fields=${fields}&limit=${safeLimit}&access_token=${token}`;
    } else {
      const fields =
        'id,message,story,created_time,full_picture,permalink_url,comments.summary(true).limit(0)';
      url = `https://graph.facebook.com/v19.0/${conn.platformId}/posts?fields=${fields}&limit=${safeLimit}&access_token=${token}`;
    }
    if (after) {
      url += `&after=${encodeURIComponent(after)}`;
    }

    let data: any;
    try {
      const response = await fetch(url);
      data = await response.json();
      if (!response.ok) {
        const message =
          data?.error?.message || 'فشل جلب المنشورات من فيسبوك';
        throw new BadRequestException(message);
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'فشل جلب المنشورات من فيسبوك',
      );
    }

    const items = Array.isArray(data?.data) ? data.data : [];
    const posts = items.map((item: any) => {
      if (conn.platform === 'INSTAGRAM') {
        return {
          id: item.id,
          message: item.caption || '',
          picture:
            item.media_type === 'VIDEO'
              ? item.thumbnail_url || null
              : item.media_url || null,
          createdTime: item.timestamp,
          permalink: item.permalink || null,
          commentsCount: item.comments_count ?? 0,
        };
      }
      return {
        id: item.id,
        message: item.message || item.story || '',
        picture: item.full_picture || null,
        createdTime: item.created_time,
        permalink: item.permalink_url || null,
        commentsCount: item.comments?.summary?.total_count ?? 0,
      };
    });

    return {
      posts,
      nextCursor: data?.paging?.cursors?.after || null,
      hasMore: Boolean(data?.paging?.next),
    };
  }

  async updateConnection(tenantId: string, id: string, data: { name: string }) {
    const conn = await this.prisma.platformConnection.findFirst({
      where: { id, tenantId },
    });
    if (!conn) {
      throw new NotFoundException('القناة غير موجودة');
    }

    const updated = await this.prisma.platformConnection.update({
      where: { id },
      data: { name: data.name },
    });

    return {
      ...updated,
      accessToken: updated.accessToken ? '***' : null,
    };
  }

  generateOAuthState(tenantId: string): string {
    const secret =
      this.configService.get<string>('APP_SECRET') || 'default-app-secret-key';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(tenantId);
    const sig = hmac.digest('hex');
    return `${tenantId}.${sig}`;
  }

  verifyOAuthState(state: string): string | null {
    if (!state) return null;
    const parts = state.split('.');
    if (parts.length !== 2) return null;
    const [tenantId, sig] = parts;
    const secret =
      this.configService.get<string>('APP_SECRET') || 'default-app-secret-key';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(tenantId);
    const expectedSig = hmac.digest('hex');
    try {
      const bufSig = Buffer.from(sig);
      const bufExpected = Buffer.from(expectedSig);
      if (
        bufSig.length === bufExpected.length &&
        crypto.timingSafeEqual(bufSig, bufExpected)
      ) {
        return tenantId;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }
}
