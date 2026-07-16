import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { MailService } from '../mail/mail.service';

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly mailService: MailService,
  ) {}

  @Get('settings')
  async getSettings() {
    return this.platformSettings.getAllForAdmin();
  }

  @Put('settings')
  async updateSettings(@Body() body: Record<string, string>) {
    return this.platformSettings.setMany(body);
  }

  @Post('settings/test-email')
  async sendTestEmail(@Request() req: any) {
    const result = await this.mailService.sendTestEmail(req.user.email);
    if (!result.sent) {
      return {
        sent: false,
        message:
          'فشل الإرسال. تحقق من إعدادات SMTP (الخادم، المنفذ، بيانات الدخول).',
      };
    }
    return {
      sent: true,
      message: `تم إرسال رسالة اختبار إلى ${req.user.email}`,
    };
  }

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('stats/daily-replies')
  async getDailyRepliesStats() {
    return this.adminService.getDailyRepliesStats();
  }

  @Get('tenants')
  async getTenants(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.adminService.getTenants(
      search,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  @Put('tenants/:id')
  async updateTenant(
    @Param('id') id: string,
    @Body() body: { plan?: string; isSuspended?: boolean },
  ) {
    return this.adminService.updateTenant(id, body);
  }

  @Delete('tenants/:id')
  async deleteTenant(@Param('id') id: string) {
    return this.adminService.deleteTenant(id);
  }

  @Get('users')
  async getUsers(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.adminService.getUsers(
      search,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  @Put('users/:id')
  async updateUser(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { isSuperAdmin?: boolean },
  ) {
    return this.adminService.updateUser(id, req.user.id, body);
  }

  @Delete('users/:id')
  async deleteUser(@Request() req: any, @Param('id') id: string) {
    return this.adminService.deleteUser(id, req.user.id);
  }

  @Post('users/:id/verify-email')
  async verifyUserEmail(@Param('id') id: string) {
    return this.adminService.verifyUserEmail(id);
  }

  @Post('users/:id/reset-password')
  async resetUserPassword(@Param('id') id: string) {
    return this.adminService.sendUserPasswordReset(id);
  }

  @Post('tenants/:id/email')
  async emailTenant(
    @Param('id') id: string,
    @Body() body: { subject: string; body: string },
  ) {
    return this.adminService.emailTenant(id, body.subject, body.body);
  }

  @Post('announcements')
  async sendAnnouncement(@Body() body: { subject: string; body: string }) {
    return this.adminService.sendAnnouncement(body.subject, body.body);
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.adminService.getAuditLogs(
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 50,
      tenantId,
    );
  }
}
