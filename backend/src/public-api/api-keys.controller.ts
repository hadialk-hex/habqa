import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

// Dashboard-side management of the tenant's public-API credentials and
// outbound webhook. Key material is returned exactly once at creation.
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private prisma: PrismaService) {}

  private assertOwnerOrAdmin(req: any) {
    if (req.user.role !== 'OWNER' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('غير مصرح لك بإدارة مفاتيح API');
    }
  }

  @Get()
  async list(@Request() req: any) {
    return this.prisma.apiKey.findMany({
      where: { tenantId: req.user.tenantId },
      select: {
        id: true,
        name: true,
        prefix: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  async create(@Request() req: any, @Body() body: { name?: string }) {
    this.assertOwnerOrAdmin(req);
    const count = await this.prisma.apiKey.count({
      where: { tenantId: req.user.tenantId },
    });
    if (count >= 5) {
      throw new BadRequestException(
        'الحد الأقصى 5 مفاتيح. احذف مفتاحاً أولاً.',
      );
    }

    const secret = `hq_live_${crypto.randomBytes(24).toString('hex')}`;
    const created = await this.prisma.apiKey.create({
      data: {
        tenantId: req.user.tenantId,
        name: (body?.name || 'API Key').slice(0, 60),
        keyHash: crypto.createHash('sha256').update(secret).digest('hex'),
        prefix: secret.slice(0, 16),
      },
      select: { id: true, name: true, prefix: true, createdAt: true },
    });
    // The only time the full key ever leaves the server
    return { ...created, key: secret };
  }

  @Delete(':id')
  async revoke(@Request() req: any, @Param('id') id: string) {
    this.assertOwnerOrAdmin(req);
    const key = await this.prisma.apiKey.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });
    if (!key) throw new BadRequestException('المفتاح غير موجود');
    await this.prisma.apiKey.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Outbound webhook (message.received events to the tenant's server) ──

  @Get('webhook')
  async getWebhook(@Request() req: any) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: { outboundWebhookUrl: true },
    });
    return {
      url: tenant?.outboundWebhookUrl || '',
      hasSecret: true,
    };
  }

  @Put('webhook')
  async setWebhook(@Request() req: any, @Body() body: { url?: string }) {
    this.assertOwnerOrAdmin(req);
    const url = (body?.url || '').trim();
    // https required in the real world; plain http allowed only for local dev
    if (
      url &&
      !/^https:\/\/.+/.test(url) &&
      !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
    ) {
      throw new BadRequestException('الرابط يجب أن يبدأ بـ https://');
    }
    // A fresh signing secret is issued whenever the URL is (re)configured;
    // clearing the URL clears the secret too.
    const secret = url ? crypto.randomBytes(24).toString('hex') : null;
    await this.prisma.tenant.update({
      where: { id: req.user.tenantId },
      data: { outboundWebhookUrl: url || null, outboundWebhookSecret: secret },
    });
    // Shown once, like API keys — used to verify x-hubqa-signature
    return { url, secret };
  }
}
