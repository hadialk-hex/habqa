import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(id: string, tenantId: string) {
    return this.prisma.notification.updateMany({
      where: { id, tenantId },
      data: { read: true },
    });
  }

  async markAllAsRead(tenantId: string) {
    return this.prisma.notification.updateMany({
      where: { tenantId, read: false },
      data: { read: true },
    });
  }

  async delete(id: string, tenantId: string) {
    return this.prisma.notification.deleteMany({
      where: { id, tenantId },
    });
  }

  // Helper for internal use (other modules can inject this service to create notifications)
  async createNotification(tenantId: string, title: string, message: string, type: 'message' | 'subscriber' | 'rule' | 'system') {
    return this.prisma.notification.create({
      data: {
        tenantId,
        title,
        message,
        type,
      },
    });
  }
}
