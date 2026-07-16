import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelsService } from '../channels/channels.service';
import { GRAPH_API_BASE } from '../common/graph-api';

@Injectable()
export class InboxService {
  constructor(
    private prisma: PrismaService,
    private channelsService: ChannelsService,
  ) {}

  async getConversations(
    tenantId: string,
    connectionId?: string,
    page?: number,
    limit?: number,
    view?: string,
  ) {
    const where: any = { tenantId };
    if (connectionId) {
      where.connectionId = connectionId;
    }
    // Business-Suite-style tabs: "comments" lists conversations with comment
    // activity, "messages" lists DM conversations. A conversation holding
    // both (comment → private reply flows) rightfully appears in both tabs.
    if (view === 'comments') {
      where.messages = { some: { messageType: 'COMMENT' } };
    } else if (view === 'messages') {
      where.messages = { some: { messageType: { not: 'COMMENT' } } };
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

  private async sendPlatformMessage(
    connection: any,
    customerId: string,
    content: string,
  ) {
    if (!connection.accessToken) {
      throw new Error('Revoked token');
    }

    const token = this.channelsService.getDecryptedAccessToken(
      connection.accessToken,
    );
    if (!token) {
      throw new Error('Revoked token');
    }

    if (connection.platform === 'WHATSAPP') {
      // WhatsApp Cloud API
      const response = await fetch(
        `${GRAPH_API_BASE}/${connection.platformId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: customerId,
            type: 'text',
            text: { body: content },
          }),
        },
      );
      if (!response.ok) {
        const err: any = await response.json().catch(() => ({}));
        throw new Error(
          err?.error?.message || `WhatsApp API error: ${response.status}`,
        );
      }
    } else {
      // Facebook Messenger & Instagram DM — use Send API
      const response = await fetch(`${GRAPH_API_BASE}/me/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_type: 'RESPONSE',
          recipient: { id: customerId },
          message: { text: content },
        }),
      });
      if (!response.ok) {
        const err: any = await response.json().catch(() => ({}));
        throw new Error(
          err?.error?.message || `Graph API error: ${response.status}`,
        );
      }
    }
  }

  // Replies publicly to the conversation's latest inbound comment (Facebook
  // /{comment-id}/comments, Instagram /{ig-comment-id}/replies) — the
  // Business-Suite behavior when an agent answers from the comments tab.
  private async sendPlatformComment(
    connection: any,
    conversationId: string,
    content: string,
  ) {
    const lastComment = await this.prisma.message.findFirst({
      where: {
        conversationId,
        direction: 'INBOUND',
        messageType: 'COMMENT',
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!lastComment?.metaData) {
      throw new BadRequestException('لا يوجد تعليق للرد عليه في هذه المحادثة');
    }
    let commentId: string | null = null;
    try {
      const raw = lastComment.metaData;
      const meta: any = typeof raw === 'string' ? JSON.parse(raw) : raw;
      commentId = meta?.comment_id || meta?.id || null;
    } catch {
      commentId = null;
    }
    if (!commentId) {
      throw new BadRequestException('تعذر تحديد معرف التعليق للرد عليه');
    }

    const token = this.channelsService.getDecryptedAccessToken(
      connection.accessToken,
    );
    const url =
      connection.platform === 'INSTAGRAM'
        ? `${GRAPH_API_BASE}/${commentId}/replies`
        : `${GRAPH_API_BASE}/${commentId}/comments`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: content }),
    });
    if (!response.ok) {
      const err: any = await response.json().catch(() => ({}));
      throw new BadRequestException(
        err?.error?.message ||
          `فشل إرسال الرد على التعليق (${response.status})`,
      );
    }
  }

  async sendMessage(
    tenantId: string,
    conversationId: string,
    content: string,
    senderUserId?: string,
    mode?: string,
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
      if (mode === 'comment') {
        await this.sendPlatformComment(
          conv.connection,
          conversationId,
          content,
        );
      } else {
        await this.sendPlatformMessage(
          conv.connection,
          conv.customerId,
          content,
        );
      }
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
        messageType: mode === 'comment' ? 'COMMENT' : 'TEXT',
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

    // The frontend marks a conversation read with a body-less PATCH — body
    // arrives undefined, so guard every access or the request 500s.
    const updateData: any = {};
    if (body?.status) {
      updateData.status = body.status;
    } else if (body?.read === true) {
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
