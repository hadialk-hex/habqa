import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelsService } from '../channels/channels.service';
import {
  graphApiRequest,
  sendWhatsAppMessage,
} from '../common/graph-api-client';
import { telegramRequest } from '../common/telegram-api';

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

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
    conversationId: string,
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

    if (connection.platform === 'TELEGRAM') {
      const res = await telegramRequest(token, 'sendMessage', {
        chat_id: customerId,
        text: content,
      });
      if (!res.ok) {
        throw new Error(`Telegram API error: ${res.description}`);
      }
    } else if (connection.platform === 'WHATSAPP') {
      const res = await sendWhatsAppMessage(
        connection.platformId,
        customerId,
        { type: 'text', text: content },
        token,
      );
      if (!res.ok) {
        throw new Error(
          `WhatsApp API error: ${res.error?.message || res.status}`,
        );
      }
    } else {
      // ── Messenger / Instagram DM ──
      // Determine the correct messaging_type:
      //   • RESPONSE — default, works within the 24-hour standard messaging window.
      //   • MESSAGE_TAG + HUMAN_AGENT — only valid for Messenger when the customer
      //     HAS messaged us before AND the last inbound is older than 24 hours.
      //   • Instagram does NOT support MESSAGE_TAG at all — always use RESPONSE.
      let messagingType = 'RESPONSE';
      let tag: string | undefined;

      if (connection.platform !== 'INSTAGRAM') {
        const lastInbound = await this.prisma.message.findFirst({
          where: { conversationId, direction: 'INBOUND' },
          orderBy: { createdAt: 'desc' },
        });

        if (lastInbound) {
          const hoursSinceLastInbound =
            (Date.now() - lastInbound.createdAt.getTime()) / (1000 * 60 * 60);

          if (hoursSinceLastInbound > 24) {
            // Customer messaged us, but it was more than 24h ago.
            // Use HUMAN_AGENT tag to extend the window (Messenger only).
            messagingType = 'MESSAGE_TAG';
            tag = 'HUMAN_AGENT';
            this.logger.log(
              `[sendPlatformMessage] Using HUMAN_AGENT tag (last inbound ${Math.round(hoursSinceLastInbound)}h ago) for conversation ${conversationId}`,
            );
          }
        }
        // If no inbound message exists at all, we're doing a proactive outreach.
        // We still try RESPONSE — Facebook will reject it if the user never
        // messaged us, but that's the correct behavior (no HUMAN_AGENT without
        // prior conversation).
      }

      const body: any = {
        messaging_type: messagingType,
        recipient: { id: customerId },
        message: { text: content },
      };
      if (tag) {
        body.tag = tag;
      }

      this.logger.log(
        `[sendPlatformMessage] Sending to ${connection.platform} | customerId=${customerId} | messaging_type=${messagingType}${tag ? ` | tag=${tag}` : ''}`,
      );

      const res = await graphApiRequest('/me/messages', {
        method: 'POST',
        token,
        body,
        context: 'inboxSendPlatformMessage',
      });

      if (!res.ok) {
        const errMsg = res.error?.message || `HTTP ${res.status}`;
        this.logger.error(
          `[sendPlatformMessage] FAILED for conversation ${conversationId}: ${errMsg}`,
        );
        throw new Error(`Graph API error: ${errMsg}`);
      }

      this.logger.log(
        `[sendPlatformMessage] SUCCESS for conversation ${conversationId}`,
      );
    }
  }

  // Replies publicly to the conversation's latest inbound comment
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
    const path =
      connection.platform === 'INSTAGRAM'
        ? `/${commentId}/replies`
        : `/${commentId}/comments`;

    const res = await graphApiRequest(path, {
      method: 'POST',
      token,
      body: { message: content },
      context: 'inboxSendPlatformComment',
    });

    if (!res.ok) {
      throw new BadRequestException(
        res.error?.message || `فشل إرسال الرد على التعليق (${res.status})`,
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
          conversationId,
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
      // Surface the Graph API error message to the frontend
      this.logger.error(
        `[sendMessage] Failed for conversation ${conversationId}: ${error.message}`,
      );
      const userMsg = error.message?.includes('Graph API error')
        ? `فشل إرسال الرسالة: ${error.message.replace('Graph API error: ', '')}`
        : `فشل إرسال الرسالة: ${error.message || 'خطأ غير معروف'}`;
      throw new BadRequestException(userMsg);
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
