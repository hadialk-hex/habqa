import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InboxService } from '../inbox/inbox.service';
import { ApiKeyGuard } from './api-key.guard';

function pageArgs(page?: string, limit?: string) {
  const l = Math.min(Math.max(parseInt(limit || '25', 10) || 25, 1), 100);
  const p = Math.max(parseInt(page || '1', 10) || 1, 1);
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}

// Public REST API v1 — tenant-scoped via API key (see ApiKeyGuard).
// Base path in production: https://hubqa.hex-tic.xyz/api/backend/public/v1
@UseGuards(ApiKeyGuard)
@Controller('public/v1')
export class PublicApiController {
  constructor(
    private prisma: PrismaService,
    private inboxService: InboxService,
  ) {}

  @Get('me')
  async me(@Request() req: any) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: req.apiTenantId },
      select: { id: true, name: true, plan: true, createdAt: true },
    });
    return { tenant };
  }

  @Get('subscribers')
  async subscribers(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { skip, take, page: p, limit: l } = pageArgs(page, limit);
    const [items, total] = await Promise.all([
      this.prisma.subscriber.findMany({
        where: { tenantId: req.apiTenantId },
        select: {
          id: true,
          name: true,
          phone: true,
          platform: true,
          tags: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.subscriber.count({ where: { tenantId: req.apiTenantId } }),
    ]);
    return { data: items, page: p, limit: l, total };
  }

  @Get('conversations')
  async conversations(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { skip, take, page: p, limit: l } = pageArgs(page, limit);
    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { tenantId: req.apiTenantId },
        select: {
          id: true,
          customerId: true,
          customerName: true,
          status: true,
          lastMessageAt: true,
          connection: { select: { platform: true, name: true } },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.conversation.count({ where: { tenantId: req.apiTenantId } }),
    ]);
    return { data: items, page: p, limit: l, total };
  }

  @Get('conversations/:id/messages')
  async messages(@Request() req: any, @Param('id') id: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id, tenantId: req.apiTenantId },
    });
    if (!conv) throw new BadRequestException('Conversation not found');
    const data = await this.prisma.message.findMany({
      where: { conversationId: id },
      select: {
        id: true,
        direction: true,
        content: true,
        messageType: true,
        sentByName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return { data };
  }

  // Sends through the exact same pipeline as the dashboard inbox — platform
  // routing, 24h/HUMAN_AGENT handling, and realtime broadcast included.
  @Post('conversations/:id/messages')
  async send(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { content?: string },
  ) {
    if (!body?.content || !body.content.trim()) {
      throw new BadRequestException('content is required');
    }
    const message = await this.inboxService.sendMessage(
      req.apiTenantId,
      id,
      body.content.trim(),
      undefined,
    );
    return { data: message };
  }
}
