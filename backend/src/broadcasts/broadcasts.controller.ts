import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BroadcastsService } from './broadcasts.service';
import { CreateBroadcastDto, ScheduleBroadcastDto } from './dto/broadcasts.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('broadcasts')
export class BroadcastsController {
  constructor(private readonly broadcastsService: BroadcastsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req: any, @Body() dto: CreateBroadcastDto) {
    return this.broadcastsService.create(req.user.tenantId, dto);
  }

  @Post(':id/schedule')
  @HttpCode(HttpStatus.OK)
  async schedule(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ScheduleBroadcastDto,
  ) {
    return this.broadcastsService.schedule(req.user.tenantId, id, dto);
  }

  @Post(':id/execute')
  @HttpCode(HttpStatus.OK)
  async execute(@Request() req: any, @Param('id') id: string) {
    return this.broadcastsService.execute(req.user.tenantId, id);
  }

  @Get(':id/metrics')
  @HttpCode(HttpStatus.OK)
  async getMetrics(@Request() req: any, @Param('id') id: string) {
    return this.broadcastsService.getMetrics(req.user.tenantId, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Request() req: any, @Param('id') id: string) {
    return this.broadcastsService.cancel(req.user.tenantId, id);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Request() req: any) {
    return this.broadcastsService.findAll(req.user.tenantId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.broadcastsService.findOne(req.user.tenantId, id);
  }
}
