import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelsService } from '../channels/channels.service';
import { AiService } from '../ai/ai.service';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FlowEngineService } from '../flows/flow-engine.service';
import { getPlanLimits, startOfCurrentMonth } from '../common/plan-limits';
import { GRAPH_API_BASE } from '../common/graph-api';
import { parseKeywords, matchesKeywords } from '../common/keyword-match';
import {
  graphApiRequest,
  sendTypingIndicator,
  sendWhatsAppMessage as sendWhatsAppMsg,
} from '../common/graph-api-client';

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
      await this.notifications.createNotification(
        tenantId,
        title,
        message,
        type,
      );
    } catch (error: any) {
      this.logger.warn(`Failed to create notification: ${error.message}`);
    }
  }

  // Captures a Subscriber row for a contact on first inbound contact —
  // previously only WhatsApp did this, so Messenger/Instagram/Telegram
  // contacts were invisible to broadcast segmentation and tag-based flow
  // lookups even though they were actively messaging the business. Mirrors
  // the WhatsApp plan-limit behavior: over cap, the message still gets
  // processed, the contact just isn't stored.
  private async upsertContactSubscriber(
    connection: any,
    externalId: string,
    name: string,
    platformLabel: string,
  ) {
    const existing = await this.prisma.subscriber.findFirst({
      where: {
        tenantId: connection.tenantId,
        connectionId: connection.id,
        externalId,
      },
      select: { id: true },
    });
    if (existing) return;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: connection.tenantId },
    });
    const subscriberLimit = getPlanLimits(
      tenant?.plan || 'STARTER',
    ).maxSubscribers;
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
      return;
    }

    await this.prisma.subscriber.create({
      data: {
        tenantId: connection.tenantId,
        connectionId: connection.id,
        externalId,
        name,
        tags: [],
        platform: connection.platform,
      },
    });
    await this.notify(
      connection.tenantId,
      'مشترك جديد',
      `انضم ${name} عبر ${platformLabel}`,
      'subscriber',
    );
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
    // Meta batches multiple entries (and multiple messaging/changes items
    // per entry) into a single webhook POST. Every processing call below is
    // individually guarded so one malformed/unexpected item can't abort the
    // rest of the batch — without this, a single bad message silently drops
    // every other message that happened to arrive in the same POST.
    if (body.object === 'page' || body.object === 'instagram') {
      for (const entry of body.entry) {
        // Real Messenger/Instagram DMs arrive in entry.messaging[] (the
        // Messenger Platform format), NOT entry.changes[] — an entry carries
        // one or the other, so both must be handled or live messages are
        // silently dropped.
        for (const event of entry.messaging ?? []) {
          try {
            // is_echo = a message the page itself sent (incl. our auto-replies);
            // processing it would create bogus inbound messages and reply loops.
            if (event?.message && !event.message.is_echo) {
              await this.processPrivateDM(event, body.object, entry.id);
            } else if (event?.postback) {
              // messaging_postbacks (button presses) carry no message object —
              // synthesize one so the press lands in the inbox and its payload
              // can trigger keyword rules/flows like typed text would.
              await this.processPrivateDM(
                {
                  sender: event.sender,
                  recipient: event.recipient,
                  message: {
                    mid: `postback_${event.sender?.id}_${event.timestamp}`,
                    text: event.postback.payload || event.postback.title || '',
                  },
                },
                body.object,
                entry.id,
              );
            }
          } catch (error: any) {
            this.logger.error(
              `Failed to process messaging event for entry ${entry.id}: ${error.message}`,
            );
          }
        }
        for (const change of entry.changes ?? []) {
          try {
            if (change.field === 'feed' || change.field === 'comments') {
              await this.processComment(change.value, body.object, entry.id);
            } else if (change.field === 'messages') {
              await this.processPrivateDM(change.value, body.object, entry.id);
            }
          } catch (error: any) {
            this.logger.error(
              `Failed to process change (${change.field}) for entry ${entry.id}: ${error.message}`,
            );
          }
        }
      }
    } else if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of entry.changes ?? []) {
          try {
            if (change.field === 'messages') {
              await this.processWhatsAppMessage(change.value);
            }
          } catch (error: any) {
            this.logger.error(
              `Failed to process WhatsApp change for entry ${entry.id}: ${error.message}`,
            );
          }
        }
      }
    }
  }

  // Telegram Bot API update (https://core.telegram.org/bots/api#update).
  // Only `message` updates are subscribed; chat.id doubles as the customer
  // id AND the sendMessage target, so the inbox reply path needs no lookup.
  async processTelegramUpdate(connectionId: string, update: any) {
    const msg = update?.message;
    const chatId = msg?.chat?.id;
    if (!msg || !chatId) return;
    // Groups/channels are out of scope — auto-reply is a 1:1 support tool
    if (msg.chat.type && msg.chat.type !== 'private') return;
    if (msg.from?.is_bot) return;

    const connection = await this.prisma.platformConnection.findFirst({
      where: { id: connectionId, platform: 'TELEGRAM' },
    });
    if (!connection) {
      this.logger.error(`No TELEGRAM connection for webhook ${connectionId}`);
      return;
    }

    const eventId = `tg_${connectionId}_${msg.message_id}`;
    const duplicate = await this.prisma.webhookDeduplication.findUnique({
      where: { eventId },
    });
    if (duplicate) return;
    try {
      await this.prisma.webhookDeduplication.create({
        data: {
          eventId,
          platform: 'TELEGRAM',
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') return;
      throw error;
    }

    let messageText = msg.text || msg.caption || '';
    if (!messageText) {
      if (msg.photo) messageText = '📷 صورة';
      else if (msg.video) messageText = '🎥 فيديو';
      else if (msg.voice || msg.audio) messageText = '🎤 رسالة صوتية';
      else if (msg.document)
        messageText = `📎 ${msg.document.file_name || 'مستند'}`;
      else if (msg.sticker) messageText = '😊 ملصق';
      else if (msg.location) messageText = '📍 موقع';
      else if (msg.contact) messageText = '👤 جهة اتصال';
      else return; // unsupported update (e.g. service message) — ignore
    }

    const customerId = String(chatId);
    const customerName =
      [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') ||
      (msg.from?.username ? `@${msg.from.username}` : 'Telegram Customer');

    let conversation = await this.prisma.conversation.findUnique({
      where: {
        connectionId_customerId: { connectionId: connection.id, customerId },
      },
    });
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          tenantId: connection.tenantId,
          connectionId: connection.id,
          customerId,
          customerName,
          status: 'OPEN',
          lastMessageAt: new Date(),
        },
      });
      await this.notify(
        connection.tenantId,
        'محادثة جديدة',
        `رسالة تيليغرام جديدة من ${customerName}`,
        'message',
      );
      await this.upsertContactSubscriber(
        connection,
        customerId,
        customerName,
        'تيليغرام',
      );
    } else {
      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });
    }

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        content: messageText,
        messageType: 'TEXT',
        metaData: JSON.stringify(msg),
      },
    });

    await this.flowEngine?.processEvent({
      tenantId: connection.tenantId,
      connection,
      conversationId: conversation.id,
      customerId,
      text: messageText,
      eventType: 'MESSAGE',
    });
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

    // Parse text per WhatsApp Cloud API message type (docs: text, media with
    // optional caption, interactive/button replies carry their own title).
    let messageText = message.text?.body || '';
    if (!messageText) {
      switch (message.type) {
        case 'image':
          messageText = message.image?.caption || '📷 صورة';
          break;
        case 'video':
          messageText = message.video?.caption || '🎥 فيديو';
          break;
        case 'audio':
        case 'voice':
          messageText = '🎤 رسالة صوتية';
          break;
        case 'document':
          messageText = `📎 ${message.document?.filename || 'مستند'}`;
          break;
        case 'sticker':
          messageText = '😊 ملصق';
          break;
        case 'location':
          messageText = '📍 موقع';
          break;
        case 'contacts':
          messageText = '👤 جهة اتصال';
          break;
        case 'button':
          messageText = message.button?.text || '';
          break;
        case 'interactive':
          messageText =
            message.interactive?.button_reply?.title ||
            message.interactive?.list_reply?.title ||
            '';
          break;
      }
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
      const subscriberLimit = getPlanLimits(
        tenant?.plan || 'STARTER',
      ).maxSubscribers;
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
            connectionId: connection.id,
            externalId: senderId,
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
    // Facebook feed webhooks fire with verb add/edited/hide/remove — only a
    // newly added comment should be ingested; replying to a removed or
    // hidden comment fails at Graph and pollutes the inbox.
    if (platform === 'page' && value.verb && value.verb !== 'add') return;

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
        const keywords = parseKeywords(rule.keywords);
        const hasMatch =
          keywords.length > 0 &&
          matchesKeywords(commentText, keywords, rule.matchType || 'CONTAINS');
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

  // Public comment replies use different Graph endpoints per platform:
  // Facebook → POST /{comment-id}/comments, Instagram → POST
  // /{ig-comment-id}/replies (per the Instagram Platform docs).
  private commentReplyUrl(connection: any, commentId: string): string {
    return connection.platform === 'INSTAGRAM'
      ? `${GRAPH_API_BASE}/${commentId}/replies`
      : `${GRAPH_API_BASE}/${commentId}/comments`;
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

    const replyPath =
      connection.platform === 'INSTAGRAM'
        ? `/${commentId}/replies`
        : `/${commentId}/comments`;
    const result = await graphApiRequest(replyPath, {
      token,
      body: { message: reply },
      context: 'maybeAiReply',
    });
    if (!result.ok) return;

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

    const rule = rules.find((r) =>
      matchesKeywords(
        text,
        parseKeywords(r.keywords),
        r.matchType || 'CONTAINS',
      ),
    );
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

    if (await this.hasRecentAutomatedTriggerDm(connection.id, senderId)) {
      await this.prisma.auditLog.create({
        data: {
          tenantId: connection.tenantId,
          action: 'RULE_SKIPPED_24H_DM_LIMIT',
          entityType: 'AutoReplyRule',
          entityId: rule.id,
          newValues: JSON.stringify({ ruleId: rule.id, triggerType, senderId }),
        },
      });
      // Treat as handled so the caller doesn't fall back to a second DM path.
      return true;
    }

    const replyText = this.pickVariant(rule.privateText || rule.replyText);
    if (!replyText) return false;

    const token = this.channelsService.getDecryptedAccessToken(
      connection.accessToken,
    );

    // Show typing indicator before auto-reply for a natural feel
    await sendTypingIndicator(senderId, token);
    await new Promise((r) => setTimeout(r, 1_000));

    const result = await graphApiRequest('/me/messages', {
      token,
      body: {
        messaging_type: 'RESPONSE',
        recipient: { id: senderId },
        message: { text: replyText },
      },
      context: `handleStoryEvent:${triggerType}`,
    });
    if (!result.ok) return false;

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

  // Messenger/Instagram webhooks carry only the sender's PSID/IGSID — the
  // real name must be fetched from Graph (User Profile API). Best-effort:
  // returns null on any failure so ingestion is never blocked.
  private async fetchCustomerProfileName(
    senderId: string,
    platform: string,
    connection: any,
  ): Promise<string | null> {
    try {
      if (!connection.accessToken) return null;
      const token = this.channelsService.getDecryptedAccessToken(
        connection.accessToken,
      );
      if (!token) return null;
      const fields =
        platform === 'instagram'
          ? 'name,username'
          : 'first_name,last_name,name';
      const res = await graphApiRequest(`/${senderId}?fields=${fields}`, {
        method: 'GET',
        token,
        context: 'fetchCustomerProfile',
        maxRetries: 0,
      });
      if (!res.ok || !res.data) return null;
      const p: any = res.data;
      const name =
        p.name ||
        [p.first_name, p.last_name].filter(Boolean).join(' ') ||
        p.username;
      return typeof name === 'string' && name.trim() ? name.trim() : null;
    } catch {
      return null;
    }
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

    // Attachment-only DMs (photo, video, voice note…) have no text — show a
    // readable placeholder in the inbox instead of an empty bubble.
    // story_mention is excluded: it gets its own labels further down.
    let messageText = value.message?.text || '';
    if (!messageText && Array.isArray(value.message?.attachments)) {
      const attachmentLabels: Record<string, string> = {
        image: '📷 صورة',
        video: '🎥 فيديو',
        audio: '🎤 رسالة صوتية',
        file: '📎 ملف مرفق',
        location: '📍 موقع',
        fallback: '🔗 مشاركة رابط',
        template: '📋 قالب',
        share: '🔗 منشور تمت مشاركته',
      };
      const attType = value.message.attachments[0]?.type;
      if (attType && attType !== 'story_mention') {
        messageText = attachmentLabels[attType] || '📎 مرفق';
      }
    }
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
      const customerName =
        (await this.fetchCustomerProfileName(senderId, platform, connection)) ||
        'Customer';
      conversation = await this.prisma.conversation.create({
        data: {
          tenantId: connection.tenantId,
          connectionId: connection.id,
          customerId: senderId,
          customerName,
          status: 'OPEN',
          lastMessageAt: new Date(),
        },
      });
      await this.notify(
        connection.tenantId,
        'محادثة جديدة',
        `رسالة خاصة جديدة من ${customerName}`,
        'message',
      );
      await this.upsertContactSubscriber(
        connection,
        senderId,
        customerName,
        platform === 'page' ? 'ماسنجر' : 'انستغرام',
      );
    } else {
      // Backfill the real name for conversations created before the profile
      // lookup existed (they show as the "Customer" placeholder).
      let refreshedName: string | null = null;
      if (
        !conversation.customerName ||
        conversation.customerName === 'Customer'
      ) {
        refreshedName = await this.fetchCustomerProfileName(
          senderId,
          platform,
          connection,
        );
      }
      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          ...(refreshedName ? { customerName: refreshedName } : {}),
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
          (isStoryMention
            ? 'أشارك حسابك في ستوري 📢'
            : isStoryReply
              ? 'رد على ستوري'
              : ''),
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

  // Meta policy (Messenger Platform, effective 2026): at most one automated
  // private message per user per rolling 24h period may originate from a
  // comment or Story trigger. Re-sending on every new comment/story from the
  // same person within the window risks the connection being rate-limited.
  // Scope: comment/story-triggered DMs only — manual agent replies and
  // direct-message-triggered flows are a different, user-initiated context
  // and aren't covered by this rule.
  private async hasRecentAutomatedTriggerDm(
    connectionId: string,
    customerId: string,
  ): Promise<boolean> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { connectionId_customerId: { connectionId, customerId } },
      select: { id: true },
    });
    if (!conversation) return false;
    const recent = await this.prisma.message.findFirst({
      where: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        sentByName: 'الرد الآلي',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
    });
    return !!recent;
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

    // Meta's comment/Story-triggered-DM limit doesn't apply to WhatsApp —
    // see hasRecentAutomatedTriggerDm for the policy this enforces.
    const canSendAutomatedDm =
      connection.platform === 'WHATSAPP' ||
      !(await this.hasRecentAutomatedTriggerDm(connection.id, senderId));
    if (!canSendAutomatedDm) {
      await this.prisma.auditLog.create({
        data: {
          tenantId: connection.tenantId,
          action: 'RULE_SKIPPED_24H_DM_LIMIT',
          entityType: 'AutoReplyRule',
          entityId: rule.id,
          newValues: JSON.stringify({ ruleId: rule.id, commentId, senderId }),
        },
      });
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
        const replyPath =
          connection.platform === 'INSTAGRAM'
            ? `/${commentId}/replies`
            : `/${commentId}/comments`;
        const pubResult = await graphApiRequest(replyPath, {
          token,
          body: { message: replyVariant },
          context: 'executeRule:publicReply',
        });
        if (pubResult.ok) {
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
      }

      // Loop over sequential messages.
      // Facebook only allows `recipient: { comment_id }` for the FIRST
      // private message. Its response contains the commenter's PSID
      // (recipient_id) which must be used for every following message —
      // the comment sender id (ASID) is NOT a valid Messenger recipient.
      let psid: string | null = null;

      // Show typing indicator before the first DM for a natural feel
      // (only when we already have a PSID — first-contact uses comment_id)
      const showTypingOnce = async () => {
        if (psid) {
          await sendTypingIndicator(psid, token);
          await new Promise((r) => setTimeout(r, 800));
        }
      };

      const sendDm = async (message: any): Promise<boolean> => {
        // WhatsApp uses a different API shape
        if (connection.platform === 'WHATSAPP') {
          const waText =
            message.text ||
            message?.attachment?.payload?.url ||
            JSON.stringify(message);
          const waResult = await sendWhatsAppMsg(
            connection.platformId,
            senderId,
            { type: 'text', text: waText },
            token,
          );
          return waResult.ok;
        }

        const recipient = psid ? { id: psid } : { comment_id: commentId };
        const result = await graphApiRequest('/me/messages', {
          token,
          body: {
            messaging_type: 'RESPONSE',
            recipient,
            message,
          },
          context: 'executeRule:sendDm',
        });
        if (!result.ok) return false;
        if (result.recipientId) psid = result.recipientId;
        return true;
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

      // Send typing indicator before the first sequential message
      if (canSendAutomatedDm) await showTypingOnce();

      for (let i = 0; canSendAutomatedDm && i < replyMessages.length; i++) {
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

        const replyPath =
          connection.platform === 'INSTAGRAM'
            ? `/${commentId}/replies`
            : `/${commentId}/comments`;
        const pubResult = await graphApiRequest(replyPath, {
          token,
          body: payload,
          context: 'executeRule:legacyPublicReply',
        });

        if (pubResult.ok) {
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

        // Show typing before legacy private DM
        if (connection.platform !== 'WHATSAPP') {
          await sendTypingIndicator(senderId, token);
          await new Promise((r) => setTimeout(r, 800));
        }

        let isSuccess = false;
        if (connection.platform === 'WHATSAPP') {
          // WhatsApp outbound — extract text and send
          const waText =
            dmPayload.message?.text ||
            dmPayload.message?.attachment?.payload?.url ||
            'رسالة';
          const waResult = await sendWhatsAppMsg(
            connection.platformId,
            senderId,
            { type: 'text', text: waText },
            token,
          );
          isSuccess = waResult.ok;
        } else {
          // Messenger / Instagram — add messaging_type
          const result = await graphApiRequest('/me/messages', {
            token,
            body: {
              messaging_type: 'RESPONSE',
              ...dmPayload,
            },
            context: 'executeRule:legacyDM',
          });
          isSuccess = result.ok;
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
