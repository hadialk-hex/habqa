import {
  Injectable,
  Optional,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { getPlanLimits, startOfCurrentMonth } from '../common/plan-limits';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    @Optional() private mailService?: MailService,
  ) {}

  // Sends a news/update email to every registered user (platform newsletter)
  async sendAnnouncement(subject: string, body: string) {
    if (!subject?.trim() || !body?.trim()) {
      throw new BadRequestException('العنوان والمحتوى مطلوبان');
    }
    const mail = this.mailService;
    if (!mail || !(await mail.isConfigured())) {
      throw new BadRequestException(
        'خدمة البريد غير مفعّلة. اضبط إعدادات SMTP من تبويب "إعدادات المنصة" أولاً.',
      );
    }

    const users = await this.prisma.user.findMany({
      select: { email: true },
    });

    // Plain paragraphs → simple HTML
    const bodyHtml = body
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '')
      .map((line) => `<p>${line}</p>`)
      .join('');

    let sent = 0;
    let failed = 0;
    for (const user of users) {
      const result = await mail.sendAnnouncement(
        user.email,
        subject.trim(),
        bodyHtml,
      );
      if (result.sent) sent++;
      else failed++;
    }

    return { total: users.length, sent, failed };
  }

  async getStats() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalTenants,
      suspendedTenants,
      totalUsers,
      newUsers30d,
      totalConnections,
      activeConnections,
      totalRules,
      activeRules,
      totalConversations,
      totalMessages,
      messages7d,
      totalSubscribers,
      rulesTriggered7d,
    ] = await this.prisma.$transaction([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { isSuspended: true } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.platformConnection.count(),
      this.prisma.platformConnection.count({ where: { isActive: true } }),
      this.prisma.autoReplyRule.count(),
      this.prisma.autoReplyRule.count({ where: { isActive: true } }),
      this.prisma.conversation.count(),
      this.prisma.message.count(),
      this.prisma.message.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.subscriber.count(),
      this.prisma.auditLog.count({
        where: {
          action: 'RULE_TRIGGERED',
          createdAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    const plans = await this.prisma.tenant.groupBy({
      by: ['plan'],
      orderBy: { plan: 'asc' },
      _count: true,
    });

    const monthStart = startOfCurrentMonth();
    const REPLY_ACTIONS = ['RULE_TRIGGERED', 'AI_REPLY_SENT', 'FLOW_TRIGGERED'];
    const [repliesThisMonth, quotaSkippedThisMonth] =
      await this.prisma.$transaction([
        this.prisma.auditLog.count({
          where: {
            action: { in: REPLY_ACTIONS },
            createdAt: { gte: monthStart },
          },
        }),
        this.prisma.auditLog.count({
          where: {
            action: 'RULE_SKIPPED_QUOTA',
            createdAt: { gte: monthStart },
          },
        }),
      ]);

    // Top 5 most active tenants this month by auto-replies sent
    const topUsage = await this.prisma.auditLog.groupBy({
      by: ['tenantId'],
      where: {
        action: { in: REPLY_ACTIONS },
        createdAt: { gte: monthStart },
      },
      orderBy: { _count: { tenantId: 'desc' } },
      _count: true,
      take: 5,
    });
    const topTenantRecords = await this.prisma.tenant.findMany({
      where: { id: { in: topUsage.map((t) => t.tenantId) } },
      select: { id: true, name: true, plan: true },
    });
    const topTenants = topUsage.map((t) => {
      const tenant = topTenantRecords.find((r) => r.id === t.tenantId);
      return {
        id: t.tenantId,
        name: tenant?.name || 'محذوف',
        plan: tenant?.plan || null,
        repliesThisMonth: t._count,
      };
    });

    // Latest signups
    const recentUsers = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        memberships: {
          take: 1,
          include: { tenant: { select: { name: true, plan: true } } },
        },
      },
    });

    return {
      usage: {
        repliesThisMonth,
        quotaSkippedThisMonth,
        topTenants,
      },
      recentUsers: recentUsers.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt,
        tenantName: u.memberships[0]?.tenant?.name || null,
        plan: u.memberships[0]?.tenant?.plan || null,
      })),
      tenants: {
        total: totalTenants,
        suspended: suspendedTenants,
        byPlan: plans.map((p) => ({ plan: p.plan, count: p._count })),
      },
      users: { total: totalUsers, newLast30Days: newUsers30d },
      connections: { total: totalConnections, active: activeConnections },
      rules: {
        total: totalRules,
        active: activeRules,
        triggeredLast7Days: rulesTriggered7d,
      },
      inbox: {
        conversations: totalConversations,
        messages: totalMessages,
        messagesLast7Days: messages7d,
      },
      subscribers: { total: totalSubscribers },
    };
  }

  async getDailyRepliesStats() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: {
          in: ['RULE_TRIGGERED', 'AI_REPLY_SENT', 'FLOW_TRIGGERED'],
        },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true },
    });

    // Group by day string YYYY-MM-DD
    const countsByDay: Record<string, number> = {};
    for (const log of logs) {
      const day = log.createdAt.toISOString().split('T')[0];
      countsByDay[day] = (countsByDay[day] || 0) + 1;
    }

    // Fill in missing days with 0
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      // Format as "Aug 15" for frontend
      const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
      const displayDay = formatter.format(d);
      
      result.push({
        day: displayDay,
        replies: countsByDay[dayStr] || 0,
      });
    }

    return result;
  }

  async getTenants(search?: string, page = 1, pageSize = 20) {
    const where: any = {};
    if (search && search.trim() !== '') {
      where.name = { contains: search.trim(), mode: 'insensitive' };
    }

    const [tenants, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: {
              members: true,
              connections: true,
              rules: true,
              conversations: true,
              subscribers: true,
            },
          },
          members: {
            where: { role: 'OWNER' },
            take: 1,
            include: {
              user: { select: { email: true, name: true } },
            },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    // Replies sent this month per tenant (for quota display)
    const monthStart = startOfCurrentMonth();
    const usageRows = await this.prisma.auditLog.groupBy({
      by: ['tenantId'],
      where: {
        tenantId: { in: tenants.map((t) => t.id) },
        action: {
          in: ['RULE_TRIGGERED', 'AI_REPLY_SENT', 'FLOW_TRIGGERED'],
        },
        createdAt: { gte: monthStart },
      },
      _count: true,
    });

    return {
      tenants: tenants.map((t) => {
        const limits = getPlanLimits(t.plan);
        return {
          id: t.id,
          name: t.name,
          plan: t.plan,
          isSuspended: t.isSuspended,
          createdAt: t.createdAt,
          counts: t._count,
          owner: t.members[0]?.user || null,
          usage: {
            repliesThisMonth:
              usageRows.find((u) => u.tenantId === t.id)?._count || 0,
            maxRepliesPerMonth: limits.maxRepliesPerMonth,
            maxConnections: limits.maxConnections,
            maxSubscribers: limits.maxSubscribers,
          },
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  async updateTenant(
    id: string,
    data: { plan?: string; isSuspended?: boolean },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('المستأجر غير موجود');
    }

    const updateData: any = {};
    if (data.plan !== undefined) {
      if (!['STARTER', 'PRO', 'ENTERPRISE'].includes(data.plan)) {
        throw new BadRequestException('خطة غير صالحة');
      }
      updateData.plan = data.plan;
    }
    if (data.isSuspended !== undefined) {
      updateData.isSuspended = Boolean(data.isSuspended);
    }

    return this.prisma.tenant.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('المستأجر غير موجود');
    }
    // Cascading deletes remove members, connections, rules, conversations, etc.
    return this.prisma.tenant.delete({ where: { id } });
  }

  async getUsers(search?: string, page = 1, pageSize = 20) {
    const where: any = {};
    if (search && search.trim() !== '') {
      where.OR = [
        { email: { contains: search.trim(), mode: 'insensitive' } },
        { name: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          isSuperAdmin: true,
          createdAt: true,
          memberships: {
            include: {
              tenant: { select: { id: true, name: true, plan: true } },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        isSuperAdmin: u.isSuperAdmin,
        createdAt: u.createdAt,
        tenants: u.memberships.map((m) => ({
          id: m.tenant.id,
          name: m.tenant.name,
          plan: m.tenant.plan,
          role: m.role,
        })),
      })),
      total,
      page,
      pageSize,
    };
  }

  async updateUser(
    id: string,
    currentAdminId: string,
    data: { isSuperAdmin?: boolean },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }
    if (id === currentAdminId && data.isSuperAdmin === false) {
      throw new BadRequestException(
        'لا يمكنك إزالة صلاحية الأدمن عن نفسك',
      );
    }
    if (data.isSuperAdmin === undefined) {
      throw new BadRequestException('لا يوجد شيء لتعديله');
    }

    return this.prisma.user.update({
      where: { id },
      data: { isSuperAdmin: Boolean(data.isSuperAdmin) },
      select: { id: true, email: true, name: true, isSuperAdmin: true },
    });
  }

  async getAuditLogs(page = 1, pageSize = 50, tenantId?: string) {
    const where: any = {};
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          tenant: { select: { name: true } },
          user: { select: { email: true, name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total, page, pageSize };
  }
}
