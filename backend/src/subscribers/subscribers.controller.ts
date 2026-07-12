import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SubscribersService } from './subscribers.service';
import {
  CreateSubscriberDto,
  UpdateSubscriberDto,
} from './dto/subscribers.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('subscribers')
export class SubscribersController {
  constructor(private readonly subscribersService: SubscribersService) {}

  @Post()
  async create(@Request() req: any, @Body() dto: CreateSubscriberDto) {
    return this.subscribersService.create(req.user.tenantId, dto);
  }

  @Get()
  async findAll(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tags') tags?: string,
    @Query('platform') platform?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const parsedPage = (pageNum && !isNaN(pageNum) && pageNum > 0) ? pageNum : undefined;
    const parsedLimit = (limitNum && !isNaN(limitNum) && limitNum > 0) ? limitNum : undefined;

    return this.subscribersService.findAll(
      req.user.tenantId,
      search,
      parsedPage,
      parsedLimit,
      tags,
      platform,
    );
  }

  @Get('tags')
  async findUniqueTags(@Request() req: any) {
    return this.subscribersService.findUniqueTags(req.user.tenantId);
  }

  @Get('stats')
  async getStats(@Request() req: any) {
    return this.subscribersService.getSubscriberStats(req.user.tenantId);
  }

  @Get(':id/conversation')
  async getConversationHistory(@Request() req: any, @Param('id') id: string) {
    return this.subscribersService.getConversationHistory(req.user.tenantId, id);
  }

  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.subscribersService.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSubscriberDto,
  ) {
    return this.subscribersService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.subscribersService.remove(req.user.tenantId, id);
  }
}
