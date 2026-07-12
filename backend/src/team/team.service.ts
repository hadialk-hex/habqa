import {
  Injectable,
  Optional,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  InviteMemberDto,
  UpdateMemberRoleDto,
  AcceptInvitationDto,
  TenantRole,
} from './dto/team.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class TeamService {
  constructor(
    private prisma: PrismaService,
    @Optional() private mailService?: MailService,
  ) {}

  async inviteMember(
    tenantId: string,
    inviterRole: TenantRole,
    dto: InviteMemberDto,
  ) {
    if (inviterRole !== TenantRole.OWNER && inviterRole !== TenantRole.ADMIN) {
      throw new ForbiddenException('Only OWNER or ADMIN can invite members');
    }

    if (
      (dto.role as any) === TenantRole.OWNER ||
      (dto.role as any) === 'OWNER'
    ) {
      throw new BadRequestException('Cannot invite someone as OWNER');
    }

    // Block only when the email already belongs to a member of this tenant.
    // Existing platform users can still be invited; acceptInvitation links them.
    const existingMember = await this.prisma.tenantMember.findFirst({
      where: {
        tenantId,
        user: { email: dto.email },
      },
    });

    if (existingMember) {
      throw new ConflictException('User is already a member of this team');
    }

    // Check if an active invitation already exists for this tenant
    const existingInvitation = await this.prisma.teamInvitation.findFirst({
      where: {
        tenantId,
        email: dto.email,
        accepted: false,
      },
    });

    if (existingInvitation) {
      throw new ConflictException(
        'An active invitation already exists for this email',
      );
    }

    const token = 'inv_tok_' + crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const invitation = await this.prisma.teamInvitation.create({
      data: {
        tenantId,
        email: dto.email,
        role: dto.role,
        token,
        expiresAt,
      },
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteUrl = `${frontendUrl}/accept-invite?token=${token}`;
    await this.mailService?.sendTeamInvitation(
      dto.email,
      inviteUrl,
      tenant?.name || 'فريق حبقة',
      dto.role,
    );

    return invitation;
  }

  async acceptInvitation(dto: AcceptInvitationDto) {
    const invitation = await this.prisma.teamInvitation.findUnique({
      where: { token: dto.token },
    });

    if (
      !invitation ||
      invitation.accepted ||
      invitation.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    const tenantId = invitation.tenantId;
    const email = invitation.email;
    const role = invitation.role as TenantRole;
    const invitationId = invitation.id;

    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: dto.name,
          password: hashedPassword,
        },
      });
    }

    const existingMember = await this.prisma.tenantMember.findFirst({
      where: {
        userId: user.id,
        tenantId,
      },
    });

    if (!existingMember) {
      await this.prisma.tenantMember.create({
        data: {
          userId: user.id,
          tenantId,
          role,
        },
      });
    }

    await this.prisma.teamInvitation.update({
      where: { id: invitationId },
      data: { accepted: true },
    });

    return { message: 'Invitation accepted successfully' };
  }

  async listPendingInvitations(tenantId: string) {
    return this.prisma.teamInvitation.findMany({
      where: {
        tenantId,
        accepted: false,
        expiresAt: { gte: new Date() },
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelInvitation(
    tenantId: string,
    requesterRole: TenantRole,
    invitationId: string,
  ) {
    if (
      requesterRole !== TenantRole.OWNER &&
      requesterRole !== TenantRole.ADMIN
    ) {
      throw new ForbiddenException('Only OWNER or ADMIN can cancel invitations');
    }
    const invitation = await this.prisma.teamInvitation.findFirst({
      where: { id: invitationId, tenantId },
    });
    if (!invitation) {
      throw new NotFoundException('الدعوة غير موجودة');
    }
    return this.prisma.teamInvitation.delete({ where: { id: invitationId } });
  }

  async listMembers(tenantId: string) {
    return this.prisma.tenantMember.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async updateMemberRole(
    tenantId: string,
    currentUserId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const requester = await this.prisma.tenantMember.findFirst({
      where: { tenantId, userId: currentUserId },
    });

    if (
      !requester ||
      (requester.role !== 'OWNER' && requester.role !== 'ADMIN')
    ) {
      throw new ForbiddenException(
        'Only OWNER or ADMIN can manage team members',
      );
    }

    if (
      (dto.role as any) === TenantRole.OWNER ||
      (dto.role as any) === 'OWNER'
    ) {
      throw new BadRequestException('Cannot assign OWNER role');
    }

    const member = await this.prisma.tenantMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    if (member.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied to this member');
    }

    if (member.userId === currentUserId) {
      throw new BadRequestException('Cannot update own role');
    }

    if (member.role === 'OWNER') {
      throw new BadRequestException('Cannot update owner role');
    }

    return this.prisma.tenantMember.update({
      where: { id: memberId },
      data: { role: dto.role },
    });
  }

  async removeMember(
    tenantId: string,
    currentUserId: string,
    memberId: string,
  ) {
    const requester = await this.prisma.tenantMember.findFirst({
      where: { tenantId, userId: currentUserId },
    });

    if (
      !requester ||
      (requester.role !== 'OWNER' && requester.role !== 'ADMIN')
    ) {
      throw new ForbiddenException(
        'Only OWNER or ADMIN can manage team members',
      );
    }

    const member = await this.prisma.tenantMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    if (member.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied to this member');
    }

    if (member.userId === currentUserId) {
      throw new BadRequestException('Cannot remove yourself');
    }

    if (member.role === 'OWNER') {
      throw new BadRequestException('Cannot delete the workspace owner');
    }

    return this.prisma.tenantMember.delete({
      where: { id: memberId },
    });
  }
}
