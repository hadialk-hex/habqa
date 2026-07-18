import { Module } from '@nestjs/common';
import { InboxModule } from '../inbox/inbox.module';
import { ApiKeysController } from './api-keys.controller';
import { PublicApiController } from './public-api.controller';
import { ApiKeyGuard } from './api-key.guard';

@Module({
  imports: [InboxModule],
  controllers: [ApiKeysController, PublicApiController],
  providers: [ApiKeyGuard],
})
export class PublicApiModule {}
