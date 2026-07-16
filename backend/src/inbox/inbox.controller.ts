import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { InboxService } from './inbox.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('inbox')
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get('conversations')
  async getConversations(
    @Request() req: any,
    @Query('connectionId') connectionId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('view') view?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.inboxService.getConversations(
      req.user.tenantId,
      connectionId,
      pageNum,
      limitNum,
      view,
    );
  }

  @Get('conversations/:id/messages')
  async getMessages(@Request() req: any, @Param('id') id: string) {
    return this.inboxService.getMessages(req.user.tenantId, id);
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { content: string; mode?: string },
  ) {
    return this.inboxService.sendMessage(
      req.user.tenantId,
      id,
      body.content,
      req.user.id,
      body.mode,
    );
  }

  @Patch('conversations/:id/assign')
  async assignConversation(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { assignedToId: string | null },
  ) {
    return this.inboxService.assignConversation(
      req.user.tenantId,
      id,
      body.assignedToId,
    );
  }

  @Patch('conversations/:id/read')
  async updateReadStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.inboxService.updateReadStatus(req.user.tenantId, id, body);
  }

  // --- Canned Responses ---

  @Get('canned-responses')
  async getCannedResponses(@Request() req: any) {
    return this.inboxService.getCannedResponses(req.user.tenantId);
  }

  @Post('canned-responses')
  async createCannedResponse(
    @Request() req: any,
    @Body() body: { title: string; content: string },
  ) {
    return this.inboxService.createCannedResponse(
      req.user.tenantId,
      body.title,
      body.content,
    );
  }
}
