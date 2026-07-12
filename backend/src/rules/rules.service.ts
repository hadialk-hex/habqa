import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RulesService {
  constructor(private prisma: PrismaService) {}

  async getRules(tenantId: string) {
    return this.prisma.autoReplyRule.findMany({
      where: { tenantId },
      include: { connection: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, data: any) {
    return this.prisma.autoReplyRule.create({
      data: {
        tenantId,
        connectionId: data.connectionId,
        postId: data.postId,
        name: data.name,
        triggerType: data.triggerType,
        keywords: data.keywords,
        matchType: data.matchType || 'EXACT',
        replyText: data.replyText,
        replyMedia: data.replyMedia ? data.replyMedia : undefined,
        replyMessages: data.replyMessages ? data.replyMessages : undefined,
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

    // Server-managed stats must never be client-writable
    const {
      triggerCount: _triggerCount,
      lastTriggeredAt: _lastTriggeredAt,
      ...safeData
    } = data;

    return this.prisma.autoReplyRule.update({
      where: { id },
      data: {
        ...safeData,
        replyMedia: data.replyMedia ? data.replyMedia : undefined,
        replyMessages: data.replyMessages ? data.replyMessages : undefined,
        privateMedia: data.privateMedia ? data.privateMedia : undefined,
      },
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
