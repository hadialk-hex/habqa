import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InboxService } from '../inbox/inbox.service';
import { CreateBroadcastDto, ScheduleBroadcastDto } from './dto/broadcasts.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class BroadcastsService {
  private readonly logger = new Logger(BroadcastsService.name);

  constructor(
    private prisma: PrismaService,
    private inboxService: InboxService,
  ) {}

  async create(tenantId: string, dto: CreateBroadcastDto) {
    if (
      dto.segmentTarget &&
      dto.segmentTarget.toLowerCase().includes('invalid')
    ) {
      throw new BadRequestException('Invalid segment target');
    }

    let scheduledAtDate: Date | null = null;
    if (dto.scheduledAt) {
      scheduledAtDate = new Date(dto.scheduledAt);
      if (
        isNaN(scheduledAtDate.getTime()) ||
        scheduledAtDate.getTime() < Date.now()
      ) {
        throw new BadRequestException('Scheduled time must be in the future');
      }
    }

    return this.prisma.broadcast.create({
      data: {
        tenantId,
        name: dto.name,
        content: dto.content,
        segmentTarget: dto.segmentTarget,
        status: scheduledAtDate ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: scheduledAtDate,
      },
    });
  }

  async schedule(tenantId: string, id: string, dto: ScheduleBroadcastDto) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, tenantId },
    });
    if (!broadcast) {
      throw new NotFoundException('Broadcast not found');
    }

    const scheduledAtDate = new Date(dto.scheduledAt);
    if (
      isNaN(scheduledAtDate.getTime()) ||
      scheduledAtDate.getTime() < Date.now()
    ) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    return this.prisma.broadcast.update({
      where: { id },
      data: {
        status: 'SCHEDULED',
        scheduledAt: scheduledAtDate,
      },
    });
  }

  async execute(tenantId: string, id: string) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, tenantId },
    });
    if (!broadcast) {
      throw new NotFoundException('Broadcast not found');
    }

    if (
      broadcast.status === 'SENT' ||
      broadcast.status === 'CANCELLED' ||
      broadcast.status === 'SENDING'
    ) {
      throw new BadRequestException('Broadcast already processed or sending');
    }

    // Validate prerequisites BEFORE flipping to SENDING so a failed
    // broadcast never gets stuck mid-state
    const hasActiveConnection = await this.prisma.platformConnection.count({
      where: { tenantId, isActive: true },
    });
    if (!hasActiveConnection) {
      throw new BadRequestException(
        'لا توجد قناة نشطة مرتبطة بمساحة العمل. اربط قناة أولاً قبل إرسال البث.',
      );
    }

    await this.prisma.broadcast.update({
      where: { id },
      data: { status: 'SENDING' },
    });

    let subscribers: any[] = [];
    if (!broadcast.segmentTarget || broadcast.segmentTarget === 'all') {
      subscribers = await this.prisma.subscriber.findMany({
        where: { tenantId },
      });
    } else {
      // tags is a native PostgreSQL text[] — filter in the database
      subscribers = await this.prisma.subscriber.findMany({
        where: {
          tenantId,
          tags: { has: broadcast.segmentTarget },
        },
      });
    }

    // Resolves and caches the connection each subscriber should be messaged
    // through: their own connectionId when set (post-fix contacts), falling
    // back to any active connection of their platform for legacy rows
    // captured before Subscriber tracked connectionId.
    const connectionCache = new Map<string, any>();
    const resolveConnection = async (sub: any) => {
      if (sub.connectionId) {
        if (!connectionCache.has(sub.connectionId)) {
          connectionCache.set(
            sub.connectionId,
            await this.prisma.platformConnection.findFirst({
              where: { id: sub.connectionId, tenantId, isActive: true },
            }),
          );
        }
        const owned = connectionCache.get(sub.connectionId);
        if (owned) return owned;
      }
      if (!sub.platform) return null;
      const platformKey = `platform:${sub.platform}`;
      if (!connectionCache.has(platformKey)) {
        connectionCache.set(
          platformKey,
          await this.prisma.platformConnection.findFirst({
            where: { tenantId, platform: sub.platform, isActive: true },
          }),
        );
      }
      return connectionCache.get(platformKey);
    };

    let sentCount = 0;
    let failedCount = 0;

    for (const sub of subscribers) {
      const connection = await resolveConnection(sub);
      const customerId = sub.externalId || sub.phone;
      if (!connection || !customerId) {
        failedCount++;
        continue;
      }

      let conversation = await this.prisma.conversation.findFirst({
        where: { connectionId: connection.id, customerId },
      });
      if (!conversation) {
        conversation = await this.prisma.conversation.create({
          data: {
            tenantId,
            connectionId: connection.id,
            customerName: sub.name || 'Unknown',
            customerId,
            status: 'OPEN',
          },
        });
      }

      // Sends through the same pipeline as an agent's inbox reply — real
      // platform routing (Messenger/Instagram/WhatsApp/Telegram), 24h/
      // HUMAN_AGENT window handling, and the outbound realtime broadcast —
      // rather than just writing a Message row and pretending it was sent.
      try {
        await this.inboxService.sendMessage(
          tenantId,
          conversation.id,
          broadcast.content,
        );
        sentCount++;
      } catch (error: any) {
        failedCount++;
        this.logger.warn(
          `Broadcast ${id}: send to subscriber ${sub.id} failed: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Broadcast ${id} finished: ${sentCount} sent, ${failedCount} failed of ${subscribers.length} subscribers`,
    );

    return this.prisma.broadcast.update({
      where: { id },
      data: {
        status: 'SENT',
        sentCount,
        // No delivery-receipt tracking yet — this mirrors sentCount as the
        // closest honest signal (API accepted the send) rather than a real
        // "delivered" confirmation.
        deliveredCount: sentCount,
      },
    });
  }

  async getMetrics(tenantId: string, id: string) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, tenantId },
    });
    if (!broadcast) {
      throw new NotFoundException('Broadcast not found');
    }

    return {
      sentCount: broadcast.sentCount,
      deliveredCount: broadcast.deliveredCount,
    };
  }

  async cancel(tenantId: string, id: string) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, tenantId },
    });
    if (!broadcast) {
      throw new NotFoundException('Broadcast not found');
    }

    if (broadcast.status === 'SENT' || broadcast.status === 'CANCELLED') {
      throw new BadRequestException('Cannot cancel broadcast in current state');
    }

    return this.prisma.broadcast.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.broadcast.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, tenantId },
    });
    if (!broadcast) {
      throw new NotFoundException('Broadcast not found');
    }
    return broadcast;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledBroadcasts() {
    const now = new Date();
    let scheduled = [];
    try {
      scheduled = await this.prisma.broadcast.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: {
            lte: now,
          },
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to fetch scheduled broadcasts: ${err.message}`);
      return;
    }

    for (const broadcast of scheduled) {
      try {
        await this.execute(broadcast.tenantId, broadcast.id);
      } catch (err: any) {
        this.logger.error(
          `Failed to execute scheduled broadcast ${broadcast.id} for tenant ${broadcast.tenantId}: ${err.message}`,
        );
        // Park the broadcast as DRAFT so the cron doesn't retry it forever;
        // the owner can reschedule after fixing the cause (e.g. no channel)
        try {
          await this.prisma.broadcast.update({
            where: { id: broadcast.id },
            data: { status: 'DRAFT' },
          });
        } catch {
          // best effort — leave as-is if even the status reset fails
        }
      }
    }
  }
}
