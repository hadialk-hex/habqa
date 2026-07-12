import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InboxService {
  constructor(private prisma: PrismaService) {}

  async getConversations(
    tenantId: string,
    connectionId?: string,
    page?: number,
    limit?: number,
  ) {
    const where: any = { tenantId };
    if (connectionId) {
      where.connectionId = connectionId;
    }

    const skip = page && limit ? (page - 1) * limit : undefined;
    const take = limit ? Number(limit) : undefined;

    return this.prisma.conversation.findMany({
      where,
      include: {
        connection: true,
        assignedTo: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      skip,
      take,
    });
  }

  async assignConversation(
    tenantId: string,
    conversationId: string,
    assignedToId: string | null,
  ) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conv || conv.tenantId !== tenantId) {
      throw new NotFoundException('المحادثة غير موجودة');
    }

    if (assignedToId) {
      // Validate that the user belongs to the tenant
      const member = await this.prisma.tenantMember.findFirst({
        where: {
          tenantId,
          userId: assignedToId,
        },
      });
      if (!member) {
        throw new BadRequestException('المستخدم ليس عضواً في هذا الفريق');
      }
    }

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedToId,
      },
      include: {
        assignedTo: true,
      },
    });
  }

  async getMessages(tenantId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });
    if (!conv) {
      throw new NotFoundException('المحادثة غير موجودة');
    }

    return this.prisma.message.findMany({
      where: {
        conversationId,
        conversation: { tenantId },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async sendPlatformMessage(connection: any, content: string) {
    if (
      connection.accessToken &&
      (connection.accessToken.toLowerCase().includes('revoked') ||
        connection.accessToken.toLowerCase().includes('invalid'))
    ) {
      throw new Error('Revoked token');
    }
  }

  async sendMessage(
    tenantId: string,
    conversationId: string,
    content: string,
    senderUserId?: string,
  ) {
    if (!content || content.trim() === '') {
      throw new BadRequestException('محتوى الرسالة لا يمكن أن يكون فارغاً');
    }

    // Resolve the team member's display name so the inbox shows who replied
    let sentByName: string | null = null;
    if (senderUserId) {
      const sender = await this.prisma.user.findUnique({
        where: { id: senderUserId },
        select: { name: true, email: true },
      });
      sentByName = sender?.name || sender?.email || null;
    }

    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { connection: true },
    });

    if (!conv || conv.tenantId !== tenantId) {
      throw new NotFoundException('المحادثة غير موجودة');
    }

    if (!conv.connection.isActive) {
      throw new BadRequestException('الاتصال بالمنصة غير نشط');
    }

    try {
      await this.sendPlatformMessage(conv.connection, content);
    } catch (error: any) {
      if (error.message === 'Revoked token') {
        await this.prisma.platformConnection.update({
          where: { id: conv.connectionId },
          data: { isActive: false },
        });
        throw new BadRequestException('تم إلغاء صلاحية الاتصال بالمنصة');
      }
      throw error;
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        direction: 'OUTBOUND',
        content,
        messageType: 'TEXT',
        sentByName,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  }

  async updateReadStatus(tenantId: string, conversationId: string, body: any) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conv || conv.tenantId !== tenantId) {
      throw new NotFoundException('المحادثة غير موجودة');
    }

    const updateData: any = {};
    if (body.status) {
      updateData.status = body.status;
    } else if (body.read === true) {
      updateData.status = 'RESOLVED';
    }

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
    });
  }

  // --- Canned Responses ---

  async getCannedResponses(tenantId: string) {
    return this.prisma.cannedResponse.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCannedResponse(tenantId: string, title: string, content: string) {
    return this.prisma.cannedResponse.create({
      data: {
        tenantId,
        title,
        content,
      },
    });
  }
}
