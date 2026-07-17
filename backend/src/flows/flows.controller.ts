import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FlowsService } from './flows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SaveFlowDto } from './dto/flows.dto';

@UseGuards(JwtAuthGuard)
@Controller('flows')
export class FlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  @Get()
  async getFlows(@Request() req: any) {
    return this.flowsService.getFlows(req.user.tenantId);
  }

  @Get(':id')
  async getFlow(@Param('id') id: string, @Request() req: any) {
    return this.flowsService.getFlow(id, req.user.tenantId);
  }

  // Execution analytics: run totals by status + a per-step success/failure
  // funnel — powers the "التحليلات" dialog on the flows page.
  @Get(':id/analytics')
  async getFlowAnalytics(@Param('id') id: string, @Request() req: any) {
    return this.flowsService.getFlowAnalytics(id, req.user.tenantId);
  }

  @Post()
  async createFlow(@Request() req: any, @Body() dto: SaveFlowDto) {
    return this.flowsService.saveFlow(undefined, req.user.tenantId, dto);
  }

  @Put(':id')
  async updateFlow(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: SaveFlowDto,
  ) {
    return this.flowsService.saveFlow(id, req.user.tenantId, dto);
  }

  @Put(':id/toggle')
  async toggleActive(
    @Param('id') id: string,
    @Request() req: any,
    @Body('isActive') isActive: boolean,
  ) {
    return this.flowsService.toggleActive(id, req.user.tenantId, isActive);
  }

  @Delete(':id')
  async deleteFlow(@Param('id') id: string, @Request() req: any) {
    return this.flowsService.deleteFlow(id, req.user.tenantId);
  }
}
