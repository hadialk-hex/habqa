import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelsService } from '../channels/channels.service';
import { AiService } from '../ai/ai.service';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FlowEngineService } from '../flows/flow-engine.service';
import { getPlanLimits, startOfCurrentMonth } from '../common/plan-limits';
import { GRAPH_API_BASE } from '../common/graph-api';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private prisma: PrismaService,
    private channelsService: ChannelsService,
    @Optional() private aiService?: AiService,
    @Optional() private platformSettings?: PlatformSettingsService,
    @Optional() private notifications?: NotificationsService,
    @Optional() private flowEngine?: FlowEngineService,
  ) {}

  // Creates an in-app notification without ever breaking webhook processing
  private async notify(
    tenantId: string,
    title: string,
    message: string,
    type: 'message' | 'subscriber' | 'rule' | 'system',
  ) {
    if (!this.notifications) return;
    try {
      await this.notifications.createNotification(tenantId, title, message, type);
    } catch (error: any) {
      this.logger.warn(`Failed to create notification: ${error.message}`);
    }
  }

  async verifyWebhook(
    mode: string,
    token: string,
    challenge: string,
  ): Promise<string> {
    const VERIFY_TOKEN =
      (await this.platformSettings?.get('WEBHOOK_VERIFY_TOKEN')) ||
      process.env.WEBHOOK_VERIFY_TOKEN ||
      'hubqa_secure_verify_token_2026';

    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        this.logger.log('WEBHOOK_VERIFIED');
        return challenge;
      }
    }
    throw new Error('Verification failed');
  }

  async handleIncomingEvent(body: any) {
    if (body.object === 'page' || body.object === 'instagram') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === 'feed' || change.field === 'comments') {
            await this.processComment(change.value, body.object, entry.id);
          } else if (change.field === 'messages') {
            await this.processPrivateDM(change.value, body.object, entry.id);
          }
        }
      }
    } else if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            await this.processWhatsAppMessage(change.value);
          }
        }
      }
    }
  }

  async processWhatsAppMessage(value: any) {
    // If it's a status update, handle/skip appropriately
    if (value.statuses && value.statuses.length > 0) {
      for (const status of value.statuses) {
        const statusId = status.id;
        if (statusId) {
          const duplicate = await this.prisma.webhookDeduplication.findUnique({
            where: { eventId: statusId },
          });
          if (duplicate) continue;
          try {
            await this.prisma.webhookDeduplication.create({
              data: {
                eventId: statusId,
                platform: 'WHATSAPP',
                expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
              },
            });
          } catch (error: any) {
            if (error.code === 'P2002') {
              continue;
            }
            throw error;
          }
        }
      }
      return;
    }

    const contact = value.contacts?.[0];
    const message = value.messages?.[0];
    if (!message) return;

    const senderId = message.from;
    const senderName = contact?.profile?.name || 'WhatsApp Customer';

    // Parse text and handle media/caption fallback
    let messageText = message.text?.body || '';
    if (!messageText && message.type === 'image') {
      messageText = message.image?.caption || 'Image Message';
    }

    const messageId = message.id;
    if (messageId) {
      const duplicate = await this.prisma.webhookDeduplication.findUnique({
        where: { eventId: messageId },
      });
      if (duplicate) {
        this.logger.log(
          `Duplicate WhatsApp message event detected: ${messageId}. Skipping.`,
        );
        return;
      }
      try {
        await this.prisma.webhookDeduplication.create({
          data: {
            eventId: messageId,
            platform: 'WHATSAPP',
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          },
        });
      } catch (error: any) {
        if (error.code === 'P2002') {
          this.logger.log(
            `Duplicate WhatsApp message write failed due to unique constraint: ${messageId}. Skipping.`,
          );
          return;
        }
        throw error;
      }
    }

    const phoneId = value.metadata?.phone_number_id;
    let connection = null;
    if (phoneId) {
      connection = await this.prisma.platformConnection.findFirst({
        where: {
          platformId: phoneId,
          platform: 'WHATSAPP',
        },
      });
    }
    if (!connection) {
      this.logger.error(
        `No platform connection found for WhatsApp webhook event matching phone_number_id: ${phoneId}`,
      );
      return;
    }

    // 1. Create Subscriber if not exists
    let subscriber = await this.prisma.subscriber.findFirst({
      where: {
        tenantId: connection.tenantId,
        phone: senderId,
      },
    });

    const isNewSubscriber = !subscriber;
    if (!subscriber) {
      // Contact-based plan limit: over capacity → keep processing the
      // message, just don't store a new contact.
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: connection.tenantId },
      });
      const subscriberLimit = getPlanLimits(tenant?.plan || 'STARTER')
        .maxSubscribers;
      const subscriberCount =
        subscriberLimit === -1
          ? 0
          : await this.prisma.subscriber.count({
              where: { tenantId: connection.tenantId },
            });
      if (subscriberLimit !== -1 && subscriberCount >= subscriberLimit) {
        this.logger.warn(
          `Tenant ${connection.tenantId} hit the subscriber limit (${subscriberLimit}) — contact not stored.`,
        );
      } else {
        subscriber = await this.prisma.subscriber.create({
          data: {
            tenantId: connection.tenantId,
            name: senderName,
            phone: senderId,
            tags: [],
            platform: 'WHATSAPP',
          },
        });
        await this.notify(
          connection.tenantId,
          'مشترك جديد',
          `انضم ${senderName} عبر واتساب`,
          'subscriber',
        );
      }
    }

    // 2. Create/Get Conversation
    let conversation = await this.prisma.conversation.findUnique({
      where: {
        connectionId_customerId: {
          connectionId: connection.id,
          customerId: senderId,
        },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          tenantId: connection.tenantId,
          connectionId: connection.id,
          customerName: senderName,
          customerId: senderId,
          status: 'OPEN',
          lastMessageAt: new Date(),
        },
      });
      await this.notify(
        connection.tenantId,
        'محادثة جديدة',
        `رسالة واتساب جديدة من ${senderName}`,
        'message',
      );
    } else {
      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
        },
      });
    }

    // 3. Save message
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        content: messageText,
        messageType: 'TEXT',
        metaData: JSON.stringify(message),
      },
    });

    // 4. Run active flows: new-subscriber trigger first, then message triggers
    if (isNewSubscriber) {
      await this.flowEngine?.processEvent({
        tenantId: connection.tenantId,
        connection,
        conversationId: conversation.id,
        customerId: senderId,
        text: messageText,
        eventType: 'NEW_SUBSCRIBER',
      });
    }
    await this.flowEngine?.processEvent({
      tenantId: connection.tenantId,
      connection,
      conversationId: conversation.id,
      customerId: senderId,
      text: messageText,
      eventType: 'MESSAGE',
    });
  }

  async processComment(value: any, platform: string, entryId?: string) {
    const senderId = value.from?.id;
    if (!senderId) return;
    if (platform === 'page' && value.item !== 'comment') return;

    const commentId = value.comment_id || value.id;
    if (commentId) {
      const duplicate = await this.prisma.webhookDeduplication.findUnique({
        where: { eventId: commentId },
      });
      if (duplicate) {
        this.logger.log(
          `Duplicate comment event detected: ${commentId}. Skipping.`,
        );
        return;
      }
      try {
        await this.prisma.webhookDeduplication.create({
          data: {
            eventId: commentId,
            platform: platform === 'page' ? 'FACEBOOK' : 'INSTAGRAM',
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          },
        });
      } catch (error: any) {
        if (error.code === 'P2002') {
          this.logger.log(
            `Duplicate comment write failed due to unique constraint: ${commentId}. Skipping.`,
          );
          return;
        }
        throw error;
      }
    }

    const commentText = value.message || value.text || '';

    // Determine post ID based on platform
    let postId = null;
    if (platform === 'page') {
      postId = value.post_id; // Facebook
    } else if (platform === 'instagram') {
      postId = value.media?.id || value.media_id; // Instagram
    }

    const connectionPlatform =
      platform === 'page' ? 'FACEBOOK_PAGE' : 'INSTAGRAM';

    // Find the connection
    const targetPlatformId =
      entryId ||
      (value.item === 'comment' && value.post_id
        ? value.post_id.split('_')[0]
        : null);
    if (!targetPlatformId) {
      this.logger.error('No targetPlatformId extracted');
      return;
    }

    let connection = await this.prisma.platformConnection.findFirst({
      where: {
        platformId: targetPlatformId,
        platform: connectionPlatform,
      },
    });

    if (!connection) {
      const fallbackPlatformId =
        value.item === 'comment' && value.post_id
          ? value.post_id.split('_')[0]
          : null;
      if (fallbackPlatformId && fallbackPlatformId !== targetPlatformId) {
        connection = await this.prisma.platformConnection.findFirst({
          where: {
            platformId: fallbackPlatformId,
            platform: connectionPlatform,
          },
        });
      }
    }

    if (!connection) {
      this.logger.error(
        `No PlatformConnection found for targetPlatformId: ${targetPlatformId} on platform: ${connectionPlatform}`,
      );
      return;
    }

    // Ignore the page's/account's own comments (echoes of our auto-replies),
    // otherwise replying to our own reply creates an infinite loop
    if (senderId === connection.platformId) {
      this.logger.log(
        `Skipping comment from the connected page/account itself: ${senderId}`,
      );
      return;
    }

    // Scope AutoReplyRule lookup to connection's tenantId
    const rules = await this.prisma.autoReplyRule.findMany({
      where: {
        tenantId: connection.tenantId,
        isActive: true,
        OR: [{ connectionId: connection.id }, { connectionId: null }],
      },
    });

    const rankedRules = [];
    for (const rule of rules) {
      let rank = 0;
      let isTriggered = false;

      const isSpecificPost = rule.postId && rule.postId === postId;
      const isGlobal = !rule.postId;

      if (rule.triggerType === 'KEYWORD') {
        const keywords = rule.keywords
          ? rule.keywords
              .split(/[,,ØŒ]/)
              .map((k) => k.trim())
              .filter(Boolean)
          : [];
        const hasMatch = keywords.some((kw) =>
          commentText.toLowerCase().includes(kw.toLowerCase()),
        );
        if (hasMatch) {
          isTriggered = true;
          rank = isSpecificPost ? 4 : isGlobal ? 2 : 0;
        }
      } else if (rule.triggerType === 'ANY_COMMENT') {
        isTriggered = true;
        rank = isSpecificPost ? 3 : isGlobal ? 1 : 0;
      }

      if (isTriggered && rank > 0) {
        rankedRules.push({ rule, rank });
      }
    }

    // Sort by Rank descending, then by priority descending, then by createdAt ascending
    rankedRules.sort((a, b) => {
      if (b.rank !== a.rank) {
        return b.rank - a.rank;
      }
      if (b.rule.priority !== a.rule.priority) {
        return b.rule.priority - a.rule.priority;
      }
      return a.rule.createdAt.getTime() - b.rule.createdAt.getTime();
    });

    const matchedRule = rankedRules[0]?.rule || null;

    // Find or create Conversation
    const senderName = value.from?.name || 'Customer';
    let conversation = await this.prisma.conversation.findUnique({
      where: {
        connectionId_customerId: {
          connectionId: connection.id,
          customerId: senderId,
        },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          tenantId: connection.tenantId,
          connectionId: connection.id,
          customerId: senderId,
          customerName: senderName,
          status: 'OPEN',
          lastMessageAt: new Date(),
        },
      });
      await this.notify(
        connection.tenantId,
        'تعليق جديد',
        `علّق ${senderName}: ${(commentText || '').slice(0, 80)}`,
        'message',
      );
    } else {
      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
        },
      });
    }

    // Save the inbound comment as a Message
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        content: commentText,
        messageType: 'COMMENT',
        metaData: JSON.stringify(value),
      },
    });

    if (matchedRule) {
      await this.executeRule(
        matchedRule,
        senderId,
        commentId,
        connection,
        conversation,
      );
    } else {
      // No rule matched — try active flows, then the AI fallback reply
      const flowMatched =
        (await this.flowEngine?.processEvent({
          tenantId: connection.tenantId,
          connection,
          conversationId: conversation.id,
          customerId: senderId,
          commentId,
          postId: value.post_id,
          text: commentText,
          eventType: 'COMMENT',
        })) || false;
      if (!flowMatched) {
        await this.maybeAiReply(
          commentText,
          commentId,
          connection,
          conversation,
        );
      }
    }
  }

  // Sends an AI-generated public reply when the tenant enabled AI replies,
  // no rule matched, and quota allows. Counts toward the reply quota.
  private async maybeAiReply(
    commentText: string,
    commentId: string,
    connection: any,
    conversation: any,
  ) {
    if (!commentText || !this.aiService) return;
    if (!(await this.aiService.isConfigured())) return;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: connection.tenantId },
    });
    if (!tenant || !tenant.aiEnabled || !tenant.aiContext) return;

    const withinQuota = await this.hasReplyQuota(connection.tenantId);
    if (!withinQuota) {
      this.logger.warn(
        `Tenant ${connection.tenantId} exceeded quota. Skipping AI reply.`,
      );
      return;
    }

    const reply = await this.aiService.generateCommentReply(
      tenant.aiContext,
      commentText,
    );
    if (!reply) return;

    const token = this.channelsService.getDecryptedAccessToken(
      connection.accessToken,
    );

    try {
      const response = await fetch(
        `${GRAPH_API_BASE}/${commentId}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ message: reply }),
        },
      );
      if (!response.ok) {
        this.logger.error(
          `Failed to send AI comment reply: ${response.statusText}`,
        );
        return;
      }
    } catch (error) {
      this.logger.error('Failed to send AI reply due to network error', error);
      return;
    }

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        content: reply,
        messageType: 'COMMENT',
        sentByName: 'رد ذكي (AI)',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: connection.tenantId,
        action: 'AI_REPLY_SENT',
        entityType: 'Tenant',
        entityId: connection.tenantId,
        newValues: JSON.stringify({ commentId, reply }),
      },
    });
  }

  // Handles Instagram story replies and story mentions: matches active
  // STORY_REPLY / STORY_MENTION rules (highest priority first, optional
  // keyword filter) and sends the rule's private reply as a DM.
  private async handleStoryEvent(
    triggerType: 'STORY_REPLY' | 'STORY_MENTION',
    text: string,
    senderId: string,
    connection: any,
    conversation: any,
  ): Promise<boolean> {
    const rules = await this.prisma.autoReplyRule.findMany({
      where: {
        tenantId: connection.tenantId,
        isActive: true,
        triggerType,
        OR: [{ connectionId: null }, { connectionId: connection.id }],
      },
      orderBy: { priority: 'desc' },
    });

    const rule = rules.find((r) => {
      const keywords = (r.keywords || '')
        .split(/[,،]/)
        .map((k) => k.trim())
        .filter(Boolean);
      if (keywords.length === 0) return true; // no filter → always match
      const lower = (text || '').toLowerCase();
      return keywords.some((k) => lower.includes(k.toLowerCase()));
    });
    if (!rule) return false;

    if (!(await this.hasReplyQuota(connection.tenantId))) {
      await this.prisma.auditLog.create({
        data: {
          tenantId: connection.tenantId,
          action: 'RULE_SKIPPED_QUOTA',
          entityType: 'AutoReplyRule',
          entityId: rule.id,
          newValues: JSON.stringify({ ruleId: rule.id, triggerType }),
        },
      });
      return false;
    }

    const replyText = this.pickVariant(rule.privateText || rule.replyText);
    if (!replyText) return false;

    const token = this.channelsService.getDecryptedAccessToken(
      connection.accessToken,
    );
    try {
      const response = await fetch(
        `${GRAPH_API_BASE}/me/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messaging_type: 'RESPONSE',
            recipient: { id: senderId },
            message: { text: replyText },
          }),
        },
      );
      if (!response.ok) {
        this.logger.error(
          `Failed to send story ${triggerType} reply: ${response.statusText}`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error('Failed to send story reply (network)', error);
      return false;
    }

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        content: replyText,
        messageType: 'TEXT',
        sentByName: 'الرد الآلي',
      },
    });
    await this.prisma.autoReplyRule.update({
      where: { id: rule.id },
      data: { triggerCount: { increment: 1 }, lastTriggeredAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: connection.tenantId,
        action: 'RULE_TRIGGERED',
        entityType: 'AutoReplyRule',
        entityId: rule.id,
        newValues: JSON.stringify({ ruleId: rule.id, triggerType }),
      },
    });
    await this.notify(
      connection.tenantId,
      triggerType === 'STORY_REPLY' ? 'رد على ستوري' : 'منشن في ستوري',
      `تم الرد آلياً على تفاعل ستوري جديد`,
      'rule',
    );
    return true;
  }

  async processPrivateDM(value: any, platform: string, entryId?: string) {
    const senderId = value.sender?.id;
    const recipientId = value.recipient?.id;
    if (!senderId) return;

    const messageId = value.message?.mid;
    if (messageId) {
      const duplicate = await this.prisma.webhookDeduplication.findUnique({
        where: { eventId: messageId },
      });
      if (duplicate) {
        this.logger.log(`Duplicate DM detected: ${messageId}. Skipping.`);
        return;
      }
      try {
        await this.prisma.webhookDeduplication.create({
          data: {
            eventId: messageId,
            platform: platform === 'page' ? 'FACEBOOK' : 'INSTAGRAM',
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          },
        });
      } catch (error: any) {
        if (error.code === 'P2002') {
          this.logger.log(
            `Duplicate DM write failed due to unique constraint: ${messageId}. Skipping.`,
          );
          return;
        }
        throw error;
      }
    }

    const messageText = value.message?.text || '';
    const connectionPlatform =
      platform === 'page' ? 'FACEBOOK_PAGE' : 'INSTAGRAM';
    const targetPlatformId = entryId || recipientId;

    const connection = await this.prisma.platformConnection.findFirst({
      where: {
        platformId: targetPlatformId,
        platform: connectionPlatform,
      },
    });

    if (!connection) {
      this.logger.error(
        `No connection found for private DM on ${platform} matching platformId: ${targetPlatformId}`,
      );
      return;
    }

    let conversation = await this.prisma.conversation.findUnique({
      where: {
        connectionId_customerId: {
          connectionId: connection.id,
          customerId: senderId,
        },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          tenantId: connection.tenantId,
          connectionId: connection.id,
          customerId: senderId,
          customerName: 'Customer',
          status: 'OPEN',
          lastMessageAt: new Date(),
        },
      });
      await this.notify(
        connection.tenantId,
        'محادثة جديدة',
        `رسالة خاصة جديدة وصلت إلى صندوق الوارد`,
        'message',
      );
    } else {
      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
        },
      });
    }

    // Story reply / story mention detection (Instagram messaging payloads)
    const isStoryReply = !!value.message?.reply_to?.story;
    const isStoryMention =
      Array.isArray(value.message?.attachments) &&
      value.message.attachments.some((a: any) => a?.type === 'story_mention');

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        content:
          messageText ||
          (isStoryMention ? 'أشارك حسابك في ستوري 📢' : isStoryReply ? 'رد على ستوري' : ''),
        messageType: 'TEXT',
        metaData: JSON.stringify(value),
      },
    });

    // Story interactions get their own rule types (STORY_REPLY/STORY_MENTION)
    let storyHandled = false;
    if (isStoryReply || isStoryMention) {
      storyHandled = await this.handleStoryEvent(
        isStoryReply ? 'STORY_REPLY' : 'STORY_MENTION',
        messageText,
        senderId,
        connection,
        conversation,
      );
    }

    // Run active flows on incoming DMs (keyword / any-message triggers)
    if (!storyHandled) {
      await this.flowEngine?.processEvent({
        tenantId: connection.tenantId,
        connection,
        conversationId: conversation.id,
        customerId: senderId,
        text: messageText,
        eventType: 'MESSAGE',
      });
    }
  }

  // Returns true when the tenant still has reply quota left
  // (monthly plan quota + hourly anti-ban throttle)
  private async hasReplyQuota(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant || tenant.isSuspended) return false;

    const limits = getPlanLimits(tenant.plan);

    if (limits.maxRepliesPerHour !== -1) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const usedLastHour = await this.prisma.auditLog.count({
        where: {
          tenantId,
          action: { in: ['RULE_TRIGGERED', 'AI_REPLY_SENT', 'FLOW_TRIGGERED'] },
          createdAt: { gte: oneHourAgo },
        },
      });
      if (usedLastHour >= limits.maxRepliesPerHour) {
        this.logger.warn(
          `Tenant ${tenantId} hit the hourly anti-ban throttle (${limits.maxRepliesPerHour}/h).`,
        );
        return false;
      }
    }

    if (limits.maxRepliesPerMonth === -1) return true;

    const usedThisMonth = await this.prisma.auditLog.count({
      where: {
        tenantId,
        action: { in: ['RULE_TRIGGERED', 'AI_REPLY_SENT', 'FLOW_TRIGGERED'] },
        createdAt: { gte: startOfCurrentMonth() },
      },
    });
    return usedThisMonth < limits.maxRepliesPerMonth;
  }

  // Rules can define several reply variants separated by "|||".
  // A random variant is picked per reply so Facebook doesn't see the
  // exact same text repeated hundreds of times (spam signal).
  private pickVariant(text: string | null | undefined): string {
    if (!text) return '';
    const variants = text
      .split('|||')
      .map((v) => v.trim())
      .filter(Boolean);
    if (variants.length === 0) return '';
    return variants[Math.floor(Math.random() * variants.length)];
  }

  async executeRule(
    rule: any,
    senderId: string,
    commentId: string,
    connection: any,
    conversation: any,
  ) {
    const withinQuota = await this.hasReplyQuota(connection.tenantId);
    if (!withinQuota) {
      this.logger.warn(
        `Tenant ${connection.tenantId} exceeded monthly reply quota (or is suspended). Skipping rule ${rule.id}.`,
      );
      await this.prisma.auditLog.create({
        data: {
          tenantId: connection.tenantId,
          action: 'RULE_SKIPPED_QUOTA',
          entityType: 'AutoReplyRule',
          entityId: rule.id,
          newValues: JSON.stringify({ ruleId: rule.id, commentId }),
        },
      });
      return;
    }

    // Increment triggerCount and update lastTriggeredAt upon match.
    await this.prisma.autoReplyRule.update({
      where: { id: rule.id },
      data: {
        triggerCount: { increment: 1 },
        lastTriggeredAt: new Date(),
      },
    });

    const token = this.channelsService.getDecryptedAccessToken(
      connection.accessToken,
    );

    let replyMessages = [];
    if (rule.replyMessages) {
      try {
        replyMessages =
          typeof rule.replyMessages === 'string'
            ? JSON.parse(rule.replyMessages)
            : rule.replyMessages;
      } catch (e) {
        this.logger.error('Failed to parse replyMessages', e);
      }
    }

    if (Array.isArray(replyMessages) && replyMessages.length > 0) {
      // Send public reply first if replyText is configured
      const replyVariant = this.pickVariant(rule.replyText);
      if (replyVariant) {
        const payload: any = { message: replyVariant };
        try {
          const response = await fetch(
            `https://graph.facebook.com/v19.0/${commentId}/comments`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify(payload),
            },
          );
          if (response.ok) {
            await this.prisma.message.create({
              data: {
                conversationId: conversation.id,
                direction: 'OUTBOUND',
                content: replyVariant,
                messageType: 'COMMENT',
                sentByName: 'الرد الآلي',
              },
            });
          }
        } catch (error) {
          this.logger.error('Failed to send public comment reply for sequence', error);
        }
      }

      // Loop over sequential messages.
      // Facebook only allows `recipient: { comment_id }` for the FIRST
      // private message. Its response contains the commenter's PSID
      // (recipient_id) which must be used for every following message —
      // the comment sender id (ASID) is NOT a valid Messenger recipient.
      let psid: string | null = null;
      const sendDm = async (message: any): Promise<boolean> => {
        const recipient = psid ? { id: psid } : { comment_id: commentId };
        try {
          const response = await fetch(
            `${GRAPH_API_BASE}/me/messages`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ recipient, message }),
            },
          );
          if (!response.ok) {
            this.logger.error(
              `Failed to send sequential DM: ${response.statusText}`,
            );
            return false;
          }
          try {
            const data: any = await response.json();
            if (data?.recipient_id) {
              psid = data.recipient_id;
            }
          } catch {
            // body parsing is best-effort; the send itself succeeded
          }
          return true;
        } catch (error) {
          this.logger.error('Failed to send sequential DM (network)', error);
          return false;
        }
      };
      const logOutbound = async (content: string, messageType: string) => {
        await this.prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: 'OUTBOUND',
            content,
            messageType: messageType as any,
            sentByName: 'الرد الآلي',
          },
        });
      };

      for (let i = 0; i < replyMessages.length; i++) {
        const msg = replyMessages[i];

        if (msg.type === 'TEXT') {
          const text = this.pickVariant(msg.text);
          if (!text) continue;
          if (await sendDm({ text })) {
            await logOutbound(text, 'TEXT');
          }
        } else if (msg.type === 'IMAGE') {
          const caption = this.pickVariant(msg.caption);
          if (caption) {
            if (await sendDm({ text: caption })) {
              await logOutbound(caption, 'TEXT');
            }
          }
          if (msg.imageUrl) {
            const imagePayload = {
              attachment: {
                type: 'image',
                payload: { url: msg.imageUrl },
              },
            };
            if (await sendDm(imagePayload)) {
              await logOutbound(msg.imageUrl, 'IMAGE');
            }
          }
        } else if (msg.type === 'CAROUSEL') {
          const elements = (msg.cards || []).map((card: any) => ({
            title: card.title || '',
            subtitle: card.subtitle || '',
            image_url: card.imageUrl || '',
            buttons: (card.buttons || []).map((btn: any) => ({
              type: btn.type === 'url' ? 'web_url' : 'postback',
              url: btn.type === 'url' ? btn.url : undefined,
              title: btn.title || '',
              payload: btn.type === 'postback' ? btn.payload : undefined,
            })),
          }));
          const carouselPayload = {
            attachment: {
              type: 'template',
              payload: {
                template_type: 'generic',
                elements,
              },
            },
          };
          if (await sendDm(carouselPayload)) {
            await logOutbound(
              `Carousel: ${(msg.cards || []).map((c: any) => c.title).join(', ')}`,
              'TEXT',
            );
          }
        } else if (msg.type === 'QUICK_REPLIES') {
          const text = this.pickVariant(msg.text) || 'اختر أحد الخيارات:';
          const quickReplies = (msg.replies || []).map((chip: any) => ({
            content_type: 'text',
            title: chip.title || '',
            payload: chip.payload || '',
          }));
          if (await sendDm({ text, quick_replies: quickReplies })) {
            await logOutbound(
              `${text} [Quick Replies: ${(msg.replies || []).map((r: any) => r.title).join(', ')}]`,
              'TEXT',
            );
          }
        }

        if (i < replyMessages.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } else {
      // Fallback to legacy replyText/replyMedia fields
      let replyMedia = [];
      let privateMedia = [];
      if (rule.replyMedia) {
        try {
          replyMedia =
            typeof rule.replyMedia === 'string'
              ? JSON.parse(rule.replyMedia)
              : rule.replyMedia;
        } catch (e) {
          this.logger.error('Failed to parse replyMedia', e);
        }
      }
      if (rule.privateMedia) {
        try {
          privateMedia =
            typeof rule.privateMedia === 'string'
              ? JSON.parse(rule.privateMedia)
              : rule.privateMedia;
        } catch (e) {
          this.logger.error('Failed to parse privateMedia', e);
        }
      }

      // Public comment reply
      const replyVariant = this.pickVariant(rule.replyText);
      if (replyVariant || (replyMedia && replyMedia.length > 0)) {
        const payload: any = {
          message: replyVariant,
        };
        if (replyMedia && replyMedia.length > 0) {
          payload.attachment_url = replyMedia[0];
        }

        let isSuccess = false;
        try {
          const response = await fetch(
            `https://graph.facebook.com/v19.0/${commentId}/comments`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify(payload),
            },
          );
          if (response.ok) {
            isSuccess = true;
          } else {
            this.logger.error(
              `Failed to send public comment reply: ${response.statusText}`,
            );
          }
        } catch (error) {
          this.logger.error(
            'Failed to send public comment reply due to network error',
            error,
          );
        }

        if (isSuccess) {
          await this.prisma.message.create({
            data: {
              conversationId: conversation.id,
              direction: 'OUTBOUND',
              content: replyVariant || 'Media Reply',
              messageType: 'COMMENT',
              sentByName: 'الرد الآلي',
            },
          });
        }
      }

      // Private DM
      const privateVariant = this.pickVariant(rule.privateText);
      if (privateVariant || (privateMedia && privateMedia.length > 0)) {
        let dmPayload: any;
        if (privateVariant && privateMedia && privateMedia.length > 0) {
          dmPayload = {
            recipient: { comment_id: commentId },
            message: {
              attachment: {
                type: 'template',
                payload: {
                  template_type: 'generic',
                  elements: [
                    {
                      title: privateVariant,
                      image_url: privateMedia[0],
                    },
                  ],
                },
              },
            },
          };
        } else if (privateVariant) {
          dmPayload = {
            recipient: { comment_id: commentId },
            message: {
              text: privateVariant,
            },
          };
        } else {
          dmPayload = {
            recipient: { comment_id: commentId },
            message: {
              attachment: {
                type: 'image',
                payload: {
                  url: privateMedia[0],
                },
              },
            },
          };
        }

        let isSuccess = false;
        try {
          const response = await fetch(
            `${GRAPH_API_BASE}/me/messages`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify(dmPayload),
            },
          );
          if (response.ok) {
            isSuccess = true;
          } else {
            this.logger.error(
              `Failed to send private DM: ${response.statusText}`,
            );
          }
        } catch (error) {
          this.logger.error(
            'Failed to send private DM due to network error',
            error,
          );
        }

        if (isSuccess) {
          await this.prisma.message.create({
            data: {
              conversationId: conversation.id,
              direction: 'OUTBOUND',
              content: privateVariant || 'Media Private DM',
              messageType: 'TEXT',
              sentByName: 'الرد الآلي',
            },
          });
        }
      }
    }

    // Audit log entry
    await this.prisma.auditLog.create({
      data: {
        tenantId: connection.tenantId,
        action: 'RULE_TRIGGERED',
        entityType: 'AutoReplyRule',
        entityId: rule.id,
        newValues: JSON.stringify({
          ruleId: rule.id,
          senderId,
          commentId,
          conversationId: conversation.id,
        }),
      },
    });
  }
}

