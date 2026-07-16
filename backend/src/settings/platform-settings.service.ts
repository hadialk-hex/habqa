import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encryptValue, decryptValue } from '../common/crypto';

// Platform-wide settings editable from the admin panel.
// Resolution order: database value → environment variable → undefined.
// Secret values are AES-256 encrypted at rest and never returned to clients.

export interface SettingDefinition {
  key: string;
  label: string;
  group: 'mail' | 'meta' | 'ai';
  secret: boolean;
  placeholder?: string;
}

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  // ===== البريد (SMTP) =====
  {
    key: 'SMTP_HOST',
    label: 'خادم SMTP',
    group: 'mail',
    secret: false,
    placeholder: 'smtp.resend.com',
  },
  {
    key: 'SMTP_PORT',
    label: 'منفذ SMTP',
    group: 'mail',
    secret: false,
    placeholder: '587',
  },
  {
    key: 'SMTP_USER',
    label: 'اسم المستخدم',
    group: 'mail',
    secret: false,
    placeholder: 'resend',
  },
  {
    key: 'SMTP_PASS',
    label: 'كلمة المرور / مفتاح API',
    group: 'mail',
    secret: true,
  },
  {
    key: 'SMTP_FROM',
    label: 'عنوان المرسل',
    group: 'mail',
    secret: false,
    placeholder: 'حبقة Hubqa <no-reply@yourdomain.com>',
  },
  {
    key: 'SMTP_REPLY_TO',
    label: 'عنوان الرد (Reply-To) — اختياري',
    group: 'mail',
    secret: false,
    placeholder: 'support@yourdomain.com',
  },
  // ===== تطبيق ميتا =====
  {
    key: 'FACEBOOK_APP_ID',
    label: 'App ID',
    group: 'meta',
    secret: false,
    placeholder: '1234567890',
  },
  {
    key: 'FACEBOOK_APP_SECRET',
    label: 'App Secret',
    group: 'meta',
    secret: true,
  },
  {
    key: 'FACEBOOK_REDIRECT_URI',
    label: 'رابط إعادة التوجيه (OAuth)',
    group: 'meta',
    secret: false,
    placeholder: 'https://yourdomain.com/channels/facebook/callback',
  },
  {
    key: 'WEBHOOK_VERIFY_TOKEN',
    label: 'رمز تحقق الويبهوك',
    group: 'meta',
    secret: true,
  },
  // ===== انستغرام (تسجيل دخول انستغرام المستقل — لا يتطلب حساب فيسبوك) =====
  {
    key: 'INSTAGRAM_APP_ID',
    label: 'Instagram App ID',
    group: 'meta',
    secret: false,
    placeholder: '1234567890',
  },
  {
    key: 'INSTAGRAM_APP_SECRET',
    label: 'Instagram App Secret',
    group: 'meta',
    secret: true,
  },
  {
    key: 'INSTAGRAM_REDIRECT_URI',
    label: 'رابط إعادة توجيه انستغرام',
    group: 'meta',
    secret: false,
    placeholder: 'https://yourdomain.com/channels/instagram/callback',
  },
  // ===== الذكاء الاصطناعي =====
  {
    key: 'ANTHROPIC_API_KEY',
    label: 'مفتاح Anthropic API',
    group: 'ai',
    secret: true,
  },
];

const VALID_KEYS = new Set(SETTING_DEFINITIONS.map((d) => d.key));
const SECRET_KEYS = new Set(
  SETTING_DEFINITIONS.filter((d) => d.secret).map((d) => d.key),
);

@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);
  private cache: Map<string, string> | null = null;

  constructor(private prisma: PrismaService) {}

  private async loadCache(): Promise<Map<string, string>> {
    if (this.cache) return this.cache;
    const rows = await this.prisma.platformSetting.findMany();
    const map = new Map<string, string>();
    for (const row of rows) {
      try {
        map.set(
          row.key,
          SECRET_KEYS.has(row.key) ? decryptValue(row.value) : row.value,
        );
      } catch {
        this.logger.error(`Failed to decrypt setting ${row.key} — skipping`);
      }
    }
    this.cache = map;
    return map;
  }

  invalidate() {
    this.cache = null;
  }

  // DB value wins; env var is the fallback
  async get(key: string): Promise<string | undefined> {
    const cache = await this.loadCache();
    const dbValue = cache.get(key);
    if (dbValue !== undefined && dbValue !== '') return dbValue;
    const envValue = process.env[key];
    return envValue !== undefined && envValue !== '' ? envValue : undefined;
  }

  // Admin view: secrets masked, with source information
  async getAllForAdmin() {
    const cache = await this.loadCache();
    return SETTING_DEFINITIONS.map((def) => {
      const dbValue = cache.get(def.key);
      const envValue = process.env[def.key];
      const hasDb = dbValue !== undefined && dbValue !== '';
      const hasEnv = envValue !== undefined && envValue !== '';
      return {
        key: def.key,
        label: def.label,
        group: def.group,
        secret: def.secret,
        placeholder: def.placeholder || '',
        isSet: hasDb || hasEnv,
        source: hasDb ? 'db' : hasEnv ? 'env' : null,
        // Only non-secret values are ever sent to the client
        value: def.secret ? null : hasDb ? dbValue : hasEnv ? envValue : '',
      };
    });
  }

  // Upserts provided entries; empty string deletes the DB row (env fallback)
  async setMany(entries: Record<string, string>) {
    const keys = Object.keys(entries || {});
    if (keys.length === 0) {
      throw new BadRequestException('لا توجد إعدادات للحفظ');
    }
    for (const key of keys) {
      if (!VALID_KEYS.has(key)) {
        throw new BadRequestException(`إعداد غير معروف: ${key}`);
      }
    }

    for (const key of keys) {
      const raw = String(entries[key] ?? '').trim();
      if (raw === '') {
        await this.prisma.platformSetting.deleteMany({ where: { key } });
        continue;
      }
      const stored = SECRET_KEYS.has(key) ? encryptValue(raw) : raw;
      await this.prisma.platformSetting.upsert({
        where: { key },
        update: { value: stored },
        create: { key, value: stored },
      });
    }

    this.invalidate();
    this.logger.log(`Platform settings updated: ${keys.join(', ')}`);
    return { saved: keys.length };
  }
}
