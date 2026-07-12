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
  BadRequestException,
} from '@nestjs/common';
import { RulesService } from './rules.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateRuleDto, UpdateRuleDto } from './dto/rules.dto';

@UseGuards(JwtAuthGuard)
@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  async getRules(@Request() req: any) {
    return this.rulesService.getRules(req.user.tenantId);
  }

  @Post()
  async createRule(@Request() req: any, @Body() dto: CreateRuleDto) {
    if (
      dto.triggerType === 'KEYWORD' &&
      (!dto.keywords || dto.keywords.trim() === '')
    ) {
      throw new BadRequestException(
        'Keywords must not be empty for KEYWORD trigger type',
      );
    }
    return this.rulesService.create(req.user.tenantId, dto);
  }

  @Put(':id')
  async updateRule(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateRuleDto,
  ) {
    if (
      dto.triggerType === 'KEYWORD' &&
      dto.keywords !== undefined &&
      dto.keywords.trim() === ''
    ) {
      throw new BadRequestException(
        'Keywords must not be empty for KEYWORD trigger type',
      );
    }
    return this.rulesService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  async deleteRule(@Request() req: any, @Param('id') id: string) {
    return this.rulesService.deleteRule(req.user.tenantId, id);
  }

  @Get(':id/logs')
  async getRuleLogs(@Request() req: any, @Param('id') id: string) {
    return this.rulesService.getLogs(id, req.user.tenantId);
  }

  @Post(':id/trigger')
  async triggerRule(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.rulesService.trigger(id, req.user.tenantId, body);
  }
}
