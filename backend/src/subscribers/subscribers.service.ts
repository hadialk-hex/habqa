import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getPlanLimits } from '../common/plan-limits';
import {
  CreateSubscriberDto,
  UpdateSubscriberDto,
} from './dto/subscribers.dto';

@Injectable()
export class SubscribersService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateSubscriberDto) {
    await this.enforceSubscriberLimit(tenantId);
    const uniqueTags = dto.tags ? Array.from(new Set(dto.tags)) : [];
    return this.prisma.subscriber.create({
      data: {
        tenantId,
        name: dto.name,
        phone: dto.phone || null,
        email: dto.email || null,
        tags: uniqueTags,
        notes: dto.notes || null,
        platform: dto.platform || null,
      },
    });
  }

  // Contact-based plan limit (like ManyChat): STARTER 1000 / PRO 10000 /
  // ENTERPRISE unlimited. Throws when the tenant is at capacity.
  async enforceSubscriberLimit(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('مساحة العمل غير موجودة');
    const limits = getPlanLimits(tenant.plan);
    if (limits.maxSubscribers === -1) return;
    const count = await this.prisma.subscriber.count({ where: { tenantId } });
    if (count >= limits.maxSubscribers) {
      throw new ForbiddenException(
        `وصلت للحد الأقصى من جهات الاتصال في خطتك (${limits.maxSubscribers}). قم بترقية الخطة لإضافة المزيد.`,
      );
    }
  }

  async findAll(
    tenantId: string,
    search?: string,
    page?: number,
    limit?: number,
    tags?: string,
    platform?: string,
  ) {
    const where: any = { tenantId };
    if (search && search.trim() !== '') {
      const isPostgres = process.env.DATABASE_URL?.startsWith('postgresql://');
      const mode = isPostgres ? 'insensitive' : undefined;
      where.OR = [
        { name: { contains: search, mode } },
        { email: { contains: search, mode } },
        { phone: { contains: search, mode } },
        { notes: { contains: search, mode } },
        { tags: { has: search } },
      ];
    }

    if (platform && platform !== 'ALL') {
      where.platform = platform;
    }

    if (tags && tags !== 'ALL') {
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        where.tags = { hasSome: tagList };
      }
    }

    if (page !== undefined && limit !== undefined) {
      const skip = (page - 1) * limit;
      const [data, total] = await Promise.all([
        this.prisma.subscriber.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.subscriber.count({ where }),
      ]);
      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    return this.prisma.subscriber.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const subscriber = await this.prisma.subscriber.findUnique({
      where: { id },
    });

    if (!subscriber || subscriber.tenantId !== tenantId) {
      throw new NotFoundException('المشترك غير موجود');
    }

    return subscriber;
  }

  async update(tenantId: string, id: string, dto: UpdateSubscriberDto) {
    await this.findOne(tenantId, id);

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.phone !== undefined) updateData.phone = dto.phone || null;
    if (dto.email !== undefined) updateData.email = dto.email || null;
    if (dto.notes !== undefined) updateData.notes = dto.notes || null;
    if (dto.platform !== undefined) updateData.platform = dto.platform || null;
    if (dto.tags !== undefined) {
      updateData.tags = Array.from(new Set(dto.tags));
    }

    return this.prisma.subscriber.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    return this.prisma.subscriber.delete({
      where: { id },
    });
  }

  async findUniqueTags(tenantId: string) {
    const subscribers = await this.prisma.subscriber.findMany({
      where: { tenantId },
      select: { tags: true },
    });
    const tagsSet = new Set<string>();
    subscribers.forEach((sub) => {
      sub.tags.forEach((tag) => tagsSet.add(tag));
    });
    return Array.from(tagsSet);
  }

  async getSubscriberStats(tenantId: string) {
    const total = await this.prisma.subscriber.count({ where: { tenantId } });

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const activeThisWeek = await this.prisma.subscriber.count({
      where: {
        tenantId,
        createdAt: { gte: oneWeekAgo },
      },
    });

    const fromFacebook = await this.prisma.subscriber.count({
      where: { tenantId, platform: 'FACEBOOK_PAGE' },
    });

    const fromWhatsapp = await this.prisma.subscriber.count({
      where: { tenantId, platform: 'WHATSAPP' },
    });

    const fromInstagram = await this.prisma.subscriber.count({
      where: { tenantId, platform: 'INSTAGRAM' },
    });

    return {
      total,
      activeThisWeek,
      fromFacebook,
      fromWhatsapp,
      fromInstagram,
    };
  }

  async getConversationHistory(tenantId: string, id: string) {
    const subscriber = await this.findOne(tenantId, id);
    const conditions: any[] = [
      { customerId: id }
    ];
    if (subscriber.phone) {
      conditions.push({ customerId: subscriber.phone });
      conditions.push({ customerId: { contains: subscriber.phone } });
    }
    if (subscriber.email) {
      conditions.push({ customerId: subscriber.email });
      conditions.push({ customerId: { contains: subscriber.email } });
    }
    if (subscriber.name) {
      conditions.push({ customerName: subscriber.name });
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        tenantId,
        OR: conditions,
      },
    });

    if (!conversation) {
      return null;
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: conversation.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return {
      ...conversation,
      messages,
    };
  }
}

