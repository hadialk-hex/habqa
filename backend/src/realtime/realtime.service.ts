import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from './realtime.gateway';

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
            select: { tenantId: true },
          });
          if (convo?.tenantId) {
            this.gateway.emitNewMessage(convo.tenantId, result);
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
}
