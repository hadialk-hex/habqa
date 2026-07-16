import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetAnalyticsDto, GetStatsDto } from './dto/dashboard.dto';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats(@Request() req: any, @Query() dto: GetStatsDto) {
    return this.dashboardService.getStats(req.user.tenantId, dto);
  }

  @Get('ai-settings')
  async getAiSettings(@Request() req: any) {
    return this.dashboardService.getAiSettings(req.user.tenantId);
  }

  @Put('ai-settings')
  async updateAiSettings(
    @Request() req: any,
    @Body() body: { aiEnabled?: boolean; aiContext?: string },
  ) {
    if (req.user.role !== 'OWNER' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'فقط مالك أو مدير مساحة العمل يمكنه تعديل إعدادات الذكاء الاصطناعي',
      );
    }
    return this.dashboardService.updateAiSettings(req.user.tenantId, body);
  }

  @Get('analytics')
  async getAnalytics(@Request() req: any, @Query() dto: GetAnalyticsDto) {
    return this.dashboardService.getAnalytics(req.user.tenantId, dto);
  }

  @Get('channel-distribution')
  async getChannelDistribution(@Request() req: any) {
    return this.dashboardService.getChannelDistribution(req.user.tenantId);
  }

  @Get('rules-metrics')
  async getRulesMetrics(@Request() req: any) {
    return this.dashboardService.getRulesMetrics(req.user.tenantId);
  }
}
