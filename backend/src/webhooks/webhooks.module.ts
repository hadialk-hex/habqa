import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ChannelsModule } from '../channels/channels.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FlowsModule } from '../flows/flows.module';

@Module({
  imports: [PrismaModule, ChannelsModule, NotificationsModule, FlowsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
