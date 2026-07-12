import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TeamService } from './team.service';
import {
  InviteMemberDto,
  UpdateMemberRoleDto,
  AcceptInvitationDto,
} from './dto/team.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @UseGuards(JwtAuthGuard)
  @Post('invitations')
  @HttpCode(HttpStatus.CREATED)
  async invite(@Request() req: any, @Body() dto: InviteMemberDto) {
    return this.teamService.inviteMember(req.user.tenantId, req.user.role, dto);
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  async accept(@Body() dto: AcceptInvitationDto) {
    return this.teamService.acceptInvitation(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('invitations')
  @HttpCode(HttpStatus.OK)
  async listInvitations(@Request() req: any) {
    return this.teamService.listPendingInvitations(req.user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('invitations/:id')
  @HttpCode(HttpStatus.OK)
  async cancelInvitation(@Request() req: any, @Param('id') id: string) {
    return this.teamService.cancelInvitation(
      req.user.tenantId,
      req.user.role,
      id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('members')
  @HttpCode(HttpStatus.OK)
  async list(@Request() req: any) {
    return this.teamService.listMembers(req.user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('members/:id')
  @HttpCode(HttpStatus.OK)
  async updateRole(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.teamService.updateMemberRole(
      req.user.tenantId,
      req.user.id,
      id,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('members/:id')
  @HttpCode(HttpStatus.OK)
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.teamService.removeMember(req.user.tenantId, req.user.id, id);
  }
}
