import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  UseGuards,
  Request,
  Post,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(@Request() req: any) {
    return this.notificationsService.findAll(req.user.tenantId);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.notificationsService.markAsRead(id, req.user.tenantId);
  }

  @Post('mark-all-read')
  async markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead(req.user.tenantId);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req: any) {
    await this.notificationsService.delete(id, req.user.tenantId);
    return { success: true };
  }
}
