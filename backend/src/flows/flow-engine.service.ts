import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelsService } from '../channels/channels.service';
import { NotificationsService } from '../notifications/notifications.service';
import { getPlanLimits, startOfCurrentMonth } from '../common/plan-limits';
import {
  graphApiRequest,
  sendTypingIndicator,
  sendWhatsAppMessage as sendWhatsAppMsg,
} from '../common/graph-api-client';
import { telegramRequest } from '../common/telegram-api';

// Runtime for the visual flow builder. Webhooks call processEvent() when a
// message / comment / new subscriber arrives; the engine matches the event
// against active flow triggers and walks the step graph:
//   SEND_MESSAGE → DM via Messenger (or WhatsApp Cloud API)
//   ADD_TAG / REMOVE_TAG → subscriber tags
//   NOTIFY_TEAM → in-app notification
//   WAIT_DELAY → execution is parked (PAUSED) and resumed by the cron
//   CONDITIONAL_BRANCH → Yes/No branch on tag / platform / time / keyword
// Every step is recorded in FlowExecutionLog for auditability.

export interface FlowEventContext {
  tenantId: string;
  connection: any; // PlatformConnection row (accessToken still encrypted)
  conversationId?: string;
  customerId: string; // PSID for DMs, ASID for comments, phone for WhatsApp
  commentId?: string; // only for COMMENT events (enables private reply)
  postId?: string;
  text?: string;
  eventType: 'MESSAGE' | 'COMMENT' | 'NEW_SUBSCRIBER';
}

const MAX_STEPS_PER_RUN = 25; // hard stop against graph cycles

@Injectable()
export class FlowEngineService {
  private readonly logger = new Logger(FlowEngineService.name);

  constructor(
    private prisma: PrismaService,
    private channelsService: ChannelsService,
    @Optional() private notifications?: NotificationsService,
  ) {}

  // ─── Entry point from webhooks. Returns true when a flow matched. ───
  async processEvent(ctx: FlowEventContext): Promise<boolean> {
    try {
      const flows = await this.prisma.flow.findMany({
        where: { tenantId: ctx.tenantId, isActive: true },
        include: { triggers: true, steps: { include: { branches: true } } },
      });

      for (const flow of flows) {
        const trigger = flow.triggers.find((t) => this.triggerMatches(t, ctx));
        if (!trigger) continue;

        if (!(await this.hasReplyQuota(ctx.tenantId))) {
          this.logger.warn(
            `Tenant ${ctx.tenantId} out of quota — flow ${flow.id} skipped.`,
          );
          return false;
        }

        await this.startExecution(flow, trigger, ctx);
        return true; // one flow per event — avoids double-replying
      }
      return false;
    } catch (error: any) {
      // A flow bug must never break webhook processing
      this.logger.error(`Flow engine failed: ${error.message}`);
      return false;
    }
  }

  private triggerMatches(trigger: any, ctx: FlowEventContext): boolean {
    const config: any = trigger.configuration || {};
    switch (trigger.type) {
      case 'ANY_MESSAGE':
        return ctx.eventType === 'MESSAGE';
      case 'KEYWORD': {
        if (ctx.eventType !== 'MESSAGE' && ctx.eventType !== 'COMMENT')
          return false;
        const keywords = String(config.keywords || '')
          .split(/[,،]/)
          .map((k: string) => k.trim())
          .filter(Boolean);
        if (keywords.length === 0) return false;
        const text = (ctx.text || '').toLowerCase();
        return keywords.some((k: string) => text.includes(k.toLowerCase()));
      }
      case 'COMMENT': {
        if (ctx.eventType !== 'COMMENT') return false;
        const postId = String(config.postId || '').trim();
        return !postId || postId === ctx.postId;
      }
      case 'NEW_SUBSCRIBER':
        return ctx.eventType === 'NEW_SUBSCRIBER';
      default:
        return false;
    }
  }

  private async startExecution(flow: any, trigger: any, ctx: FlowEventContext) {
    const firstStepId = trigger.configuration?.nextStepId || null;

    const execution = await this.prisma.flowExecution.create({
      data: {
        flowId: flow.id,
        tenantId: ctx.tenantId,
        customerId: ctx.customerId,
        status: 'RUNNING',
        currentStepId: firstStepId,
        variables: {
          connectionId: ctx.connection.id,
          conversationId: ctx.conversationId || null,
          commentId: ctx.commentId || null,
          text: ctx.text || '',
          psid: ctx.eventType === 'MESSAGE' ? ctx.customerId : null,
        },
      },
    });

    // Flow sends draw from the same anti-ban/monthly pool as rules
    await this.prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        action: 'FLOW_TRIGGERED',
        entityType: 'Flow',
        entityId: flow.id,
        newValues: JSON.stringify({ flowId: flow.id, trigger: trigger.type }),
      },
    });

    if (!firstStepId) {
      await this.finishExecution(execution.id, 'COMPLETED');
      return;
    }

    try {
      await this.runSteps(execution.id, flow.steps, firstStepId, {
        ...ctx,
        psid: ctx.eventType === 'MESSAGE' ? ctx.customerId : null,
      });
    } catch (error: any) {
      // Never leave an execution stuck in RUNNING
      this.logger.error(`Flow ${flow.id} run failed: ${error.message}`);
      await this.finishExecution(execution.id, 'FAILED');
    }
  }

  // ─── Step walker ───
  private async runSteps(
    executionId: string,
    steps: any[],
    startStepId: string,
    ctx: FlowEventContext & { psid: string | null },
  ) {
    const stepsById = new Map(steps.map((s) => [s.id, s]));
    let currentId: string | null = startStepId;
    let hops = 0;
    let psid = ctx.psid;
    let usedCommentId = false;

    // A malformed/undecryptable token must not kill the run — non-send
    // steps (tags, notifications, delays) still work without one.
    let token = '';
    try {
      token = ctx.connection.accessToken
        ? this.channelsService.getDecryptedAccessToken(
            ctx.connection.accessToken,
          )
        : '';
    } catch {
      this.logger.warn(
        `Connection ${ctx.connection.id} has an undecryptable token — flow sends disabled for this run.`,
      );
    }

    const sendDm = async (text: string): Promise<boolean> => {
      if (!token) return false;

      if (ctx.connection.platform === 'TELEGRAM') {
        const result = await telegramRequest(token, 'sendMessage', {
          chat_id: ctx.customerId,
          text,
        });
        return result.ok;
      }

      if (ctx.connection.platform === 'WHATSAPP') {
        const result = await sendWhatsAppMsg(
          ctx.connection.platformId,
          ctx.customerId,
          { type: 'text', text },
          token,
        );
        return result.ok;
      }

      // Show typing indicator for a natural feel (Messenger / Instagram)
      const recipientIdForTyping = psid || ctx.customerId;
      if (recipientIdForTyping) {
        await sendTypingIndicator(recipientIdForTyping, token);
        await new Promise((r) => setTimeout(r, 800));
      }

      // Messenger / Instagram: the FIRST private reply to a comment must
      // use recipient {comment_id}; the response's recipient_id (PSID) is
      // the only valid recipient for every message after that.
      const recipient = psid
        ? { id: psid }
        : ctx.commentId && !usedCommentId
          ? { comment_id: ctx.commentId }
          : { id: ctx.customerId };
      if ((recipient as any).comment_id) usedCommentId = true;

      const result = await graphApiRequest('/me/messages', {
        token,
        body: {
          messaging_type: 'RESPONSE',
          recipient,
          message: { text },
        },
        context: 'flowEngine:sendDm',
      });
      if (!result.ok) return false;
      if (result.recipientId) psid = result.recipientId;
      return true;
    };

    while (currentId && hops < MAX_STEPS_PER_RUN) {
      hops++;
      const step = stepsById.get(currentId);
      if (!step) break;
      const config: any = step.configuration || {};
      let logStatus: 'SUCCESS' | 'FAILED' = 'SUCCESS';
      let logError: string | null = null;
      let nextId: string | null = null;

      try {
        switch (step.type) {
          case 'SEND_MESSAGE': {
            const text = this.pickVariant(config.text);
            if (text) {
              const ok = await sendDm(text);
              if (ok && ctx.conversationId) {
                await this.prisma.message.create({
                  data: {
                    conversationId: ctx.conversationId,
                    direction: 'OUTBOUND',
                    content: text,
                    messageType: 'TEXT',
                    sentByName: 'تدفق آلي',
                  },
                });
              }
              if (!ok) {
                logStatus = 'FAILED';
                logError = 'send failed';
              }
            }
            nextId = this.nextFromBranch(step, 'Next');
            break;
          }
          case 'ADD_TAG':
          case 'REMOVE_TAG': {
            const tag = String(config.tag || '').trim();
            if (tag) await this.applyTag(ctx, tag, step.type === 'ADD_TAG');
            nextId = this.nextFromBranch(step, 'Next');
            break;
          }
          case 'NOTIFY_TEAM': {
            if (this.notifications) {
              await this.notifications.createNotification(
                ctx.tenantId,
                'إشعار من التدفق',
                String(config.message || 'تم تفعيل تدفق آلي'),
                'system',
              );
            }
            nextId = this.nextFromBranch(step, 'Next');
            break;
          }
          case 'WAIT_DELAY': {
            const amount = Number(config.delayAmount) || 5;
            const unit = String(config.delayUnit || 'minutes');
            const ms =
              unit === 'hours'
                ? amount * 3600_000
                : unit === 'days'
                  ? amount * 86400_000
                  : amount * 60_000;
            nextId = this.nextFromBranch(step, 'Next');
            await this.logStep(executionId, step, 'SUCCESS', null);
            if (nextId) {
              await this.prisma.flowExecution.update({
                where: { id: executionId },
                data: {
                  status: 'PAUSED',
                  pausedUntil: new Date(Date.now() + ms),
                  currentStepId: nextId,
                  variables: {
                    connectionId: ctx.connection.id,
                    conversationId: ctx.conversationId || null,
                    text: ctx.text || '',
                    psid,
                  },
                },
              });
            } else {
              await this.finishExecution(executionId, 'COMPLETED');
            }
            return; // the cron resumes from here
          }
          case 'CONDITIONAL_BRANCH': {
            const matched = await this.evaluateCondition(config, ctx);
            nextId = this.nextFromBranch(step, matched ? 'Yes' : 'No');
            break;
          }
          default:
            nextId = this.nextFromBranch(step, 'Next');
        }
      } catch (error: any) {
        logStatus = 'FAILED';
        logError = error.message;
        nextId = this.nextFromBranch(step, 'Next');
      }

      await this.logStep(executionId, step, logStatus, logError);
      currentId = nextId;
    }

    await this.finishExecution(executionId, 'COMPLETED');
  }

  // ─── Resume executions parked by WAIT_DELAY ───
  @Cron(CronExpression.EVERY_MINUTE)
  async resumeDueExecutions() {
    let due: any[] = [];
    try {
      due = await this.prisma.flowExecution.findMany({
        where: { status: 'PAUSED', pausedUntil: { lte: new Date() } },
        take: 20,
        include: {
          flow: { include: { steps: { include: { branches: true } } } },
        },
      });
    } catch {
      return; // DB hiccup — retry next minute
    }

    for (const execution of due) {
      try {
        const vars: any = execution.variables || {};
        const connection = await this.prisma.platformConnection.findUnique({
          where: { id: vars.connectionId || '' },
        });
        if (!connection || !execution.currentStepId) {
          await this.finishExecution(execution.id, 'FAILED');
          continue;
        }
        await this.prisma.flowExecution.update({
          where: { id: execution.id },
          data: { status: 'RUNNING', pausedUntil: null },
        });
        await this.runSteps(
          execution.id,
          execution.flow.steps,
          execution.currentStepId,
          {
            tenantId: execution.tenantId,
            connection,
            conversationId: vars.conversationId || undefined,
            customerId: execution.customerId,
            text: vars.text || '',
            eventType: 'MESSAGE',
            psid: vars.psid || null,
          },
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to resume flow execution ${execution.id}: ${error.message}`,
        );
        await this.finishExecution(execution.id, 'FAILED');
      }
    }
  }

  // ─── Helpers ───

  private nextFromBranch(step: any, label: string): string | null {
    const branch = (step.branches || []).find((b: any) => b.label === label);
    return branch?.nextStepId || null;
  }

  private pickVariant(text: string | null | undefined): string {
    if (!text) return '';
    const variants = String(text)
      .split('|||')
      .map((v) => v.trim())
      .filter(Boolean);
    if (variants.length === 0) return '';
    return variants[Math.floor(Math.random() * variants.length)];
  }

  private async evaluateCondition(
    config: any,
    ctx: FlowEventContext,
  ): Promise<boolean> {
    switch (config.conditionType) {
      case 'KEYWORD': {
        const keywords = String(config.keywords || '')
          .split(/[,،]/)
          .map((k: string) => k.trim())
          .filter(Boolean);
        const text = (ctx.text || '').toLowerCase();
        return keywords.some((k: string) => text.includes(k.toLowerCase()));
      }
      case 'PLATFORM':
        return ctx.connection.platform === config.platform;
      case 'TIME': {
        const now = new Date();
        const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const start = String(config.startTime || '00:00');
        const end = String(config.endTime || '23:59');
        return start <= end
          ? hhmm >= start && hhmm <= end
          : hhmm >= start || hhmm <= end; // overnight window (e.g. 22:00–06:00)
      }
      case 'TAG': {
        const tag = String(config.tag || '').trim();
        if (!tag) return false;
        const subscriber = await this.prisma.subscriber.findFirst({
          where: { tenantId: ctx.tenantId, phone: ctx.customerId },
        });
        return !!subscriber && subscriber.tags.includes(tag);
      }
      default:
        return false;
    }
  }

  // Subscribers double as the platform "contacts" store: for WhatsApp the
  // key is the phone number, for Messenger/Instagram it's the customer id.
  private async applyTag(ctx: FlowEventContext, tag: string, add: boolean) {
    let subscriber = await this.prisma.subscriber.findFirst({
      where: { tenantId: ctx.tenantId, phone: ctx.customerId },
    });
    if (!subscriber) {
      if (!add) return;
      // Respect the contact-based plan limit — skip creation at capacity
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: ctx.tenantId },
      });
      const max = getPlanLimits(tenant?.plan || 'STARTER').maxSubscribers;
      if (max !== -1) {
        const count = await this.prisma.subscriber.count({
          where: { tenantId: ctx.tenantId },
        });
        if (count >= max) return;
      }
      subscriber = await this.prisma.subscriber.create({
        data: {
          tenantId: ctx.tenantId,
          name: 'عميل',
          phone: ctx.customerId,
          tags: [],
          platform: ctx.connection.platform,
        },
      });
    }
    const tags = new Set(subscriber.tags);
    if (add) tags.add(tag);
    else tags.delete(tag);
    await this.prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { tags: Array.from(tags) },
    });
  }

  private async logStep(
    executionId: string,
    step: any,
    status: 'SUCCESS' | 'FAILED',
    error: string | null,
  ) {
    try {
      await this.prisma.flowExecutionLog.create({
        data: {
          executionId,
          stepId: step.id,
          stepType: step.type,
          status,
          error,
        },
      });
    } catch {
      // logging must never break the run
    }
  }

  private async finishExecution(executionId: string, status: string) {
    try {
      await this.prisma.flowExecution.update({
        where: { id: executionId },
        data: { status, currentStepId: null, pausedUntil: null },
      });
    } catch {
      // already deleted — ignore
    }
  }

  // Same pool as auto-reply rules: hourly anti-ban cap + monthly plan quota.
  private async hasReplyQuota(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant || tenant.isSuspended) return false;
    const limits = getPlanLimits(tenant.plan);
    const actions = ['RULE_TRIGGERED', 'AI_REPLY_SENT', 'FLOW_TRIGGERED'];

    if (limits.maxRepliesPerHour !== -1) {
      const usedLastHour = await this.prisma.auditLog.count({
        where: {
          tenantId,
          action: { in: actions },
          createdAt: { gte: new Date(Date.now() - 3600_000) },
        },
      });
      if (usedLastHour >= limits.maxRepliesPerHour) return false;
    }

    if (limits.maxRepliesPerMonth === -1) return true;
    const usedThisMonth = await this.prisma.auditLog.count({
      where: {
        tenantId,
        action: { in: actions },
        createdAt: { gte: startOfCurrentMonth() },
      },
    });
    return usedThisMonth < limits.maxRepliesPerMonth;
  }
}
