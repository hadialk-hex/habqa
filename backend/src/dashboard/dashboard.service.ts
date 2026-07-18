import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { GetAnalyticsDto, GetStatsDto } from './dto/dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    @Optional() private aiService?: AiService,
  ) {}

  async getAiSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { aiEnabled: true, aiContext: true },
    });
    if (!tenant) {
      throw new NotFoundException('مساحة العمل غير موجودة');
    }
    return {
      ...tenant,
      // Platform-wide switch: without an API key the feature can't run
      platformConfigured: (await this.aiService?.isConfigured()) ?? false,
    };
  }

  async updateAiSettings(
    tenantId: string,
    data: { aiEnabled?: boolean; aiContext?: string },
  ) {
    const updateData: any = {};
    if (data.aiEnabled !== undefined) {
      updateData.aiEnabled = Boolean(data.aiEnabled);
    }
    if (data.aiContext !== undefined) {
      updateData.aiContext = String(data.aiContext).slice(0, 4000);
    }
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
      select: { aiEnabled: true, aiContext: true },
    });
    return {
      ...tenant,
      platformConfigured: (await this.aiService?.isConfigured()) ?? false,
    };
  }

  async getStats(tenantId: string, dto?: GetStatsDto) {
    let currentStart: Date | null = null;
    let currentEnd: Date | null = null;
    let previousStart: Date | null = null;
    let previousEnd: Date | null = null;

    const range = dto?.range || '7days';

    let rangeDays = 7;
    if (range === 'today') {
      currentStart = new Date();
      currentStart.setHours(0, 0, 0, 0);
      currentEnd = new Date();
      currentEnd.setHours(23, 59, 59, 999);
      rangeDays = 1;
    } else if (range === '7days') {
      currentEnd = new Date();
      currentStart = new Date(currentEnd.getTime());
      currentStart.setDate(currentStart.getDate() - 7);
      currentStart.setHours(0, 0, 0, 0);
      rangeDays = 7;
    } else if (range === '30days') {
      currentEnd = new Date();
      currentStart = new Date(currentEnd.getTime());
      currentStart.setDate(currentStart.getDate() - 30);
      currentStart.setHours(0, 0, 0, 0);
      rangeDays = 30;
    } else if (range === 'custom' || (dto?.startDate && dto?.endDate)) {
      currentStart = dto?.startDate ? new Date(dto.startDate) : new Date();
      currentStart.setHours(0, 0, 0, 0);
      currentEnd = dto?.endDate ? new Date(dto.endDate) : new Date();
      currentEnd.setHours(23, 59, 59, 999);

      const diffTime = Math.abs(currentEnd.getTime() - currentStart.getTime());
      rangeDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    if (currentStart) {
      previousEnd = new Date(currentStart.getTime());
      previousStart = new Date(previousEnd.getTime());
      previousStart.setDate(previousStart.getDate() - rangeDays);
    }

    const calcTrend = (curr: number, prev: number) => {
      if (curr === 0 && prev === 0) return 0;
      if (prev === 0) return curr > 0 ? 100 : 0;
      const pct = ((curr - prev) / prev) * 100;
      return Math.round(pct * 100) / 100;
    };

    const getSubscribersCount = async (start?: Date, end?: Date) => {
      const where: any = { tenantId };
      if (start && end) {
        where.createdAt = { gte: start, lte: end };
      }
      const rows = await this.prisma.conversation.findMany({
        where,
        select: { customerId: true },
        distinct: ['customerId'],
      });
      return rows.length;
    };

    const getAutoRepliesCount = async (start?: Date, end?: Date) => {
      const where: any = {
        direction: 'OUTBOUND',
        conversation: { tenantId },
      };
      if (start && end) {
        where.createdAt = { gte: start, lte: end };
      }
      return this.prisma.message.count({ where });
    };

    const getConversationsCount = async (start?: Date, end?: Date) => {
      const where: any = { tenantId, status: 'OPEN' };
      if (start && end) {
        where.createdAt = { gte: start, lte: end };
      }
      return this.prisma.conversation.count({ where });
    };

    const getRulesCount = async (start?: Date, end?: Date) => {
      const where: any = { tenantId, isActive: true };
      if (start && end) {
        where.createdAt = { gte: start, lte: end };
      }
      return this.prisma.autoReplyRule.count({ where });
    };

    const [
      totalSubscribers,
      prevSubscribers,
      totalAutoReplies,
      prevAutoReplies,
      activeConversations,
      prevConversations,
      totalRules,
      prevRules,
      recentConversations,
      platformConnections,
    ] = await Promise.all([
      getSubscribersCount(currentStart || undefined, currentEnd || undefined),
      getSubscribersCount(previousStart || undefined, previousEnd || undefined),
      getAutoRepliesCount(currentStart || undefined, currentEnd || undefined),
      getAutoRepliesCount(previousStart || undefined, previousEnd || undefined),
      getConversationsCount(currentStart || undefined, currentEnd || undefined),
      getConversationsCount(
        previousStart || undefined,
        previousEnd || undefined,
      ),
      getRulesCount(currentStart || undefined, currentEnd || undefined),
      getRulesCount(previousStart || undefined, previousEnd || undefined),

      this.prisma.conversation.findMany({
        where: {
          tenantId,
          ...(currentStart && currentEnd
            ? { createdAt: { gte: currentStart, lte: currentEnd } }
            : {}),
        },
        include: {
          connection: {
            select: { id: true, platform: true, name: true },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        take: 5,
      }),

      this.prisma.platformConnection.findMany({
        where: {
          tenantId,
          isActive: true,
          ...(currentStart && currentEnd
            ? { createdAt: { gte: currentStart, lte: currentEnd } }
            : {}),
        },
        select: { platform: true },
      }),
    ]);

    const subscribersTrend = calcTrend(totalSubscribers, prevSubscribers);
    const autoRepliesTrend = calcTrend(totalAutoReplies, prevAutoReplies);
    const conversationsTrend = calcTrend(
      activeConversations,
      prevConversations,
    );
    const rulesTrend = calcTrend(totalRules, prevRules);

    const platformStats: Record<string, number> = {};
    for (const conn of platformConnections) {
      platformStats[conn.platform] = (platformStats[conn.platform] || 0) + 1;
    }

    let timelineStart = currentStart;
    let timelineEnd = currentEnd;

    if (!timelineStart || !timelineEnd) {
      timelineEnd = new Date();
      timelineStart = new Date();
      timelineStart.setHours(0, 0, 0, 0);
      timelineStart.setDate(timelineStart.getDate() - 13);
    }

    const recentMessages = await this.prisma.message.findMany({
      where: {
        conversation: { tenantId },
        createdAt: { gte: timelineStart, lte: timelineEnd },
      },
      select: { createdAt: true, direction: true },
    });

    const timeline: { date: string; sent: number; received: number }[] = [];
    const daysDiff =
      Math.ceil(
        Math.abs(timelineEnd.getTime() - timelineStart.getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1;
    const limitDays = Math.min(daysDiff, 100);

    for (let i = 0; i < limitDays; i++) {
      const day = new Date(timelineStart);
      day.setDate(timelineStart.getDate() + i);
      timeline.push({
        date: day.toISOString().split('T')[0],
        sent: 0,
        received: 0,
      });
    }

    for (const msg of recentMessages) {
      const dateStr = msg.createdAt.toISOString().split('T')[0];
      const entry = timeline.find((t) => t.date === dateStr);
      if (entry) {
        if (msg.direction === 'OUTBOUND') entry.sent++;
        else entry.received++;
      }
    }

    return {
      totalSubscribers,
      subscribersTrend,
      totalAutoReplies,
      autoRepliesTrend,
      activeConversations,
      conversationsTrend,
      totalRules,
      rulesTrend,
      recentConversations,
      platformStats,
      timeline,
    };
  }

  async getAnalytics(tenantId: string, dto: GetAnalyticsDto) {
    if (dto.startDate && dto.endDate) {
      const start = new Date(dto.startDate);
      const end = new Date(dto.endDate);
      if (start.getTime() > end.getTime()) {
        throw new BadRequestException('Start date cannot be after end date');
      }
    }

    if (dto.connectionId) {
      const conn = await this.prisma.platformConnection.findUnique({
        where: { id: dto.connectionId },
      });
      if (!conn) {
        throw new ForbiddenException('Connection not found');
      }
      if (conn.tenantId !== tenantId) {
        throw new ForbiddenException('You do not own this connection');
      }
    }

    const where: any = {
      conversation: {
        tenantId,
      },
    };

    if (dto.connectionId) {
      where.conversation.connectionId = dto.connectionId;
    }

    if (dto.startDate) {
      where.createdAt = {
        ...where.createdAt,
        gte: new Date(dto.startDate),
      };
    }

    if (dto.endDate) {
      const endLimit = new Date(dto.endDate);
      endLimit.setHours(23, 59, 59, 999);
      where.createdAt = {
        ...where.createdAt,
        lte: endLimit,
      };
    }

    const messages = await this.prisma.message.findMany({
      where,
      select: {
        createdAt: true,
        direction: true,
      },
    });

    const grouped: Record<
      string,
      { date: string; messagesSent: number; messagesReceived: number }
    > = {};

    for (const msg of messages) {
      const dateStr = msg.createdAt.toISOString().split('T')[0];
      if (!grouped[dateStr]) {
        grouped[dateStr] = {
          date: dateStr,
          messagesSent: 0,
          messagesReceived: 0,
        };
      }
      if (msg.direction === 'OUTBOUND') {
        grouped[dateStr].messagesSent++;
      } else {
        grouped[dateStr].messagesReceived++;
      }
    }

    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getChannelDistribution(tenantId: string) {
    const conns = await this.prisma.platformConnection.findMany({
      where: { tenantId },
      select: { platform: true },
    });
    const dist: Record<string, number> = {
      FACEBOOK_PAGE: 0,
      INSTAGRAM: 0,
      WHATSAPP: 0,
      TELEGRAM: 0,
    };
    for (const c of conns) {
      dist[c.platform] = (dist[c.platform] || 0) + 1;
    }
    return dist;
  }

  async getRulesMetrics(tenantId: string) {
    const [totalExecuted, completedCount, failedCount] = await Promise.all([
      this.prisma.flowExecution.count({
        where: { tenantId },
      }),
      this.prisma.flowExecution.count({
        where: { tenantId, status: 'COMPLETED' },
      }),
      this.prisma.flowExecution.count({
        where: { tenantId, status: 'FAILED' },
      }),
    ]);

    const successRate =
      totalExecuted > 0
        ? Math.round((completedCount / totalExecuted) * 100)
        : 100;

    return {
      successRate,
      totalExecuted,
      failedCount,
    };
  }
}
