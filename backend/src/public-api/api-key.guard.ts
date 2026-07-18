import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

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

    req.apiTenantId = apiKey.tenant.id;
    // Usage timestamp is best-effort — never blocks the request
    void this.prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
    return true;
  }
}
