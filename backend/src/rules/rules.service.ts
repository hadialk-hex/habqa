import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RulesService {
  constructor(private prisma: PrismaService) {}

  // A rule can target a specific connection or be global (connectionId
  // null). When targeted, the connection must belong to the calling
  // tenant — without this check a rule could be pointed at another
  // tenant's connection id, and getRules()'s connection include would then
  // leak that tenant's connection name/platformId/token blob.
  private async assertConnectionOwnership(
    tenantId: string,
    connectionId: unknown,
  ) {
    if (!connectionId) return;
    if (typeof connectionId !== 'string') {
      throw new BadRequestException('معرف القناة غير صالح');
    }
    const owned = await this.prisma.platformConnection.findFirst({
      where: { id: connectionId, tenantId },
      select: { id: true },
    });
    if (!owned) {
      throw new BadRequestException('القناة المحددة غير موجودة في مساحة عملك');
    }
  }

  async getRules(tenantId: string) {
    return this.prisma.autoReplyRule.findMany({
      where: { tenantId },
      include: {
        connection: {
          select: {
            id: true,
            platform: true,
            platformId: true,
            name: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, data: any) {
    await this.assertConnectionOwnership(tenantId, data.connectionId);
    return this.prisma.autoReplyRule.create({
      data: {
        tenantId,
        connectionId: data.connectionId || null,
        postId: data.postId,
        name: data.name,
        triggerType: data.triggerType,
        keywords: data.keywords,
        matchType: data.matchType || 'EXACT',
        replyText: data.replyText,
        replyMedia: data.replyMedia ? data.replyMedia : undefined,
        replyMessages: data.replyMessages ? data.replyMessages : undefined,
        quickReplies: data.quickReplies ? data.quickReplies : undefined,
        privateText: data.privateText,
        privateMedia: data.privateMedia ? data.privateMedia : undefined,
        priority: data.priority || 0,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(id: string, tenantId: string, data: any) {
    const rule = await this.prisma.autoReplyRule.findFirst({
      where: { id, tenantId },
    });
    if (!rule) throw new NotFoundException('القاعدة غير موجودة');
    if ('connectionId' in data) {
      await this.assertConnectionOwnership(tenantId, data.connectionId);
    }

    // Explicit allow-list rather than a client-data spread — a blind spread
    // silently makes every future field client-writable (tenantId, server
    // stats, etc) unless someone remembers to exclude it here too.
    const safeData: Record<string, unknown> = {};
    for (const key of [
      'connectionId',
      'postId',
      'name',
      'triggerType',
      'keywords',
      'matchType',
      'replyText',
      'privateText',
      'priority',
      'isActive',
    ]) {
      if (key in data) safeData[key] = data[key];
    }
    if ('replyMedia' in data)
      safeData.replyMedia = data.replyMedia || undefined;
    if ('replyMessages' in data)
      safeData.replyMessages = data.replyMessages || undefined;
    if ('quickReplies' in data)
      safeData.quickReplies = data.quickReplies || undefined;
    if ('privateMedia' in data)
      safeData.privateMedia = data.privateMedia || undefined;

    return this.prisma.autoReplyRule.update({
      where: { id },
      data: safeData,
    });
  }

  async deleteRule(tenantId: string, id: string) {
    const rule = await this.prisma.autoReplyRule.findFirst({
      where: { id, tenantId },
    });
    if (!rule) throw new NotFoundException('القاعدة غير موجودة');

    return this.prisma.autoReplyRule.delete({ where: { id } });
  }

  async getLogs(ruleId: string, tenantId: string) {
    const rule = await this.prisma.autoReplyRule.findFirst({
      where: { id: ruleId, tenantId },
    });
    if (!rule) {
      throw new NotFoundException('القاعدة غير موجودة');
    }
    return this.prisma.auditLog.findMany({
      where: {
        entityType: 'AutoReplyRule',
        entityId: ruleId,
        tenantId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async trigger(ruleId: string, tenantId: string, body: any) {
    const rule = await this.prisma.autoReplyRule.findFirst({
      where: { id: ruleId, tenantId },
      include: { connection: true },
    });
    if (!rule) {
      throw new NotFoundException('الرمز غير موجود');
    }
    if (rule.connection && !rule.connection.isActive) {
      throw new ForbiddenException('القناة غير نشطة');
    }

    await this.prisma.autoReplyRule.update({
      where: { id: ruleId },
      data: {
        triggerCount: { increment: 1 },
        lastTriggeredAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: 'RULE_TRIGGERED',
        entityType: 'AutoReplyRule',
        entityId: ruleId,
        oldValues: undefined,
        newValues: JSON.stringify(body || {}),
      },
    });

    return { success: true };
  }
}
