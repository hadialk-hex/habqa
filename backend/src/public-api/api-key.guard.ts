import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

// Per-API-key request budget, independent of the app-wide per-IP throttle.
// Without this, the only rate limit on /public/v1 is per source IP — a
// leaked key has no independent quota/kill-switch beyond outright revoking
// it, and integrations sharing an egress IP (office NAT, same host) throttle
// each other. In-memory fixed window: fine for a single backend instance;
// move to Redis if this ever runs as more than one process.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const requestCounts = new Map<string, { count: number; windowStart: number }>();

// Authenticates public-API requests by tenant API key (x-api-key header or
// Authorization: Bearer hq_live_…). Only the SHA-256 hash is ever stored or
// compared, so a DB leak doesn't leak usable keys.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header =
      req.headers['x-api-key'] ||
      (typeof req.headers['authorization'] === 'string' &&
      req.headers['authorization'].startsWith('Bearer ')
        ? req.headers['authorization'].slice(7)
        : '');
    const key = String(header || '').trim();
    if (!key.startsWith('hq_live_')) {
      throw new UnauthorizedException('API key missing or malformed');
    }

    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: { tenant: { select: { id: true, isSuspended: true } } },
    });
    if (!apiKey || apiKey.tenant.isSuspended) {
      throw new UnauthorizedException('Invalid API key');
    }

    const now = Date.now();
    const bucket = requestCounts.get(apiKey.id);
    if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
      requestCounts.set(apiKey.id, { count: 1, windowStart: now });
    } else {
      bucket.count++;
      if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
        throw new HttpException(
          'Rate limit exceeded for this API key',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    req.apiTenantId = apiKey.tenant.id;
    // Usage timestamp is best-effort — never blocks the request
    void this.prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
    return true;
  }
}
