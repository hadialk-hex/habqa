import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBroadcastDto, ScheduleBroadcastDto } from './dto/broadcasts.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class BroadcastsService {
  constructor(private prisma: PrismaService) {}

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
    const connection = await this.prisma.platformConnection.findFirst({
      where: { tenantId },
    });
    if (!connection) {
      throw new BadRequestException(
        'لا توجد قناة مرتبطة بمساحة العمل. اربط قناة أولاً قبل إرسال البث.',
      );
    }
    const connId = connection.id;

    await this.prisma.broadcast.update({
      where: { id },
      data: { status: 'SENDING' },
    });

    let subscribers = [];
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

    let sentCount = 0;
    let deliveredCount = 0;

    for (const sub of subscribers) {
      const customerId = sub.phone || sub.email || sub.id;
      let conversation = await this.prisma.conversation.findFirst({
        where: { connectionId: connId, customerId },
      });
      if (!conversation) {
        conversation = await this.prisma.conversation.create({
          data: {
            tenantId,
            connectionId: connId,
            customerName: sub.name || 'Unknown',
            customerId,
            status: 'OPEN',
          },
        });
      }

      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'OUTBOUND',
          content: broadcast.content,
          messageType: 'TEXT',
        },
      });

      sentCount++;
      deliveredCount++;
    }

    return this.prisma.broadcast.update({
      where: { id },
      data: {
        status: 'SENT',
        sentCount,
        deliveredCount,
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
    } catch (err) {
      console.error('Failed to fetch scheduled broadcasts:', err);
      return;
    }

    for (const broadcast of scheduled) {
      try {
        await this.execute(broadcast.tenantId, broadcast.id);
      } catch (err) {
        console.error(
          `Failed to execute scheduled broadcast ${broadcast.id} for tenant ${broadcast.tenantId}:`,
          err,
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
