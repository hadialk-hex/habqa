import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from './realtime.gateway';
import { assertPublicHttpUrl } from '../common/ssrf-guard';

// Bridges the database to the real-time gateway with a single, central hook.
// A Prisma middleware fires after every Message.create — regardless of which
// code path produced it (inbound webhook, agent reply, or automated flow) —
// resolves the owning tenant, and broadcasts the message to that tenant's
// room. This keeps the inbox live without touching any of the existing
// message-creation logic in webhooks/inbox services.
@Injectable()
export class RealtimeService implements OnModuleInit {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
  ) {}

  onModuleInit() {
    this.prisma.$use(async (params, next) => {
      const result = await next(params);
      try {
        if (
          params.model === 'Message' &&
          params.action === 'create' &&
          result?.conversationId
        ) {
          const convo = await this.prisma.conversation.findUnique({
            where: { id: result.conversationId },
            select: {
              tenantId: true,
              customerId: true,
              customerName: true,
              connection: { select: { platform: true } },
            },
          });
          if (convo?.tenantId) {
            this.gateway.emitNewMessage(convo.tenantId, result);
            // Developer integrations: forward inbound messages to the
            // tenant's outbound webhook (fire-and-forget, HMAC-signed).
            if (result.direction === 'INBOUND') {
              void this.dispatchOutboundWebhook(convo.tenantId, result, convo);
            }
          }
        }
      } catch (error) {
        // Never let a broadcast failure break a database write.
        this.logger.warn(`Realtime broadcast skipped: ${error.message}`);
      }
      return result;
    });
    this.logger.log('Realtime message broadcast hook registered');
  }

  // POSTs `message.received` to the tenant's configured webhook. The body is
  // signed with x-hubqa-signature = HMAC-SHA256(secret, rawBody) so the
  // receiver can verify authenticity. 5s timeout, never throws.
  private async dispatchOutboundWebhook(
    tenantId: string,
    message: any,
    convo: any,
  ) {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { outboundWebhookUrl: true, outboundWebhookSecret: true },
      });
      if (!tenant?.outboundWebhookUrl || !tenant.outboundWebhookSecret) return;

      // Re-validated on every dispatch, not just at save time: DNS for the
      // tenant's hostname can change between configuration and delivery
      // (rebinding), and this hook fires on a hot path so the cost of an
      // extra lookup is worth closing that window.
      try {
        await assertPublicHttpUrl(tenant.outboundWebhookUrl);
      } catch {
        this.logger.warn(
          `Outbound webhook for tenant ${tenantId} now resolves to a disallowed address — skipping delivery`,
        );
        return;
      }

      const body = JSON.stringify({
        event: 'message.received',
        timestamp: new Date().toISOString(),
        data: {
          message: {
            id: message.id,
            conversationId: message.conversationId,
            content: message.content,
            messageType: message.messageType,
            createdAt: message.createdAt,
          },
          conversation: {
            id: message.conversationId,
            customerId: convo.customerId,
            customerName: convo.customerName,
            platform: convo.connection?.platform,
          },
        },
      });
      const signature = crypto
        .createHmac('sha256', tenant.outboundWebhookSecret)
        .update(body)
        .digest('hex');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      // redirect: 'manual' — a 3xx response is treated as failure rather
      // than followed, so a validated public URL can't hop to an internal
      // one via redirect after the check above already passed.
      const res = await fetch(tenant.outboundWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hubqa-signature': signature,
        },
        body,
        signal: controller.signal,
        redirect: 'manual',
      }).finally(() => clearTimeout(timer));
      if (
        res.type === 'opaqueredirect' ||
        (res.status >= 300 && res.status < 400)
      ) {
        this.logger.warn(
          `Outbound webhook for tenant ${tenantId} returned a redirect — not followed`,
        );
      }
    } catch (error: any) {
      this.logger.warn(`Outbound webhook delivery failed: ${error.message}`);
    }
  }
}
