import { Module } from '@nestjs/common';
import { FlowsService } from './flows.service';
import { FlowEngineService } from './flow-engine.service';
import { FlowsController } from './flows.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ChannelsModule } from '../channels/channels.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, ChannelsModule, NotificationsModule],
  providers: [FlowsService, FlowEngineService],
  controllers: [FlowsController],
  exports: [FlowsService, FlowEngineService],
})
export class FlowsModule {}
