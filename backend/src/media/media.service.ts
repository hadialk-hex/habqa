import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelsService } from '../channels/channels.service';
import { uploadWhatsAppMedia } from '../common/graph-api-client';

@Injectable()
export class MediaService {
  constructor(
    private prisma: PrismaService,
    private channelsService: ChannelsService,
  ) {}

  async uploadToWhatsApp(tenantId: string, connectionId: string, file: any) {
    const conn = await this.prisma.platformConnection.findFirst({
      where: { id: connectionId, tenantId },
    });
    if (!conn) throw new NotFoundException('القناة غير موجودة');
    if (conn.platform !== 'WHATSAPP') throw new BadRequestException('القناة ليست واتساب');
    if (!conn.platformId) throw new BadRequestException('معرف المنصة غير موجود');
    
    if (!conn.accessToken) throw new BadRequestException('تحتاج لتسجيل الدخول مجدداً');
    
    const token = this.channelsService.getDecryptedAccessToken(conn.accessToken);
    if (!token) throw new BadRequestException('تحتاج لتسجيل الدخول مجدداً');

    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    
    const blob = new Blob([file.buffer], { type: file.mimetype });
    formData.append('file', blob, file.originalname);

    const res = await uploadWhatsAppMedia(conn.platformId as string, formData, token);
    if (!res.ok) {
      throw new BadRequestException(res.error?.message || 'فشل رفع الملف إلى واتساب');
    }
    
    return { success: true, mediaId: res.data?.id };
  }

  async uploadLocalFile(file: any) {
    // Basic local mock. In a real app, upload to S3/Cloudinary and return URL.
    // We simulate a public URL for the sake of the template.
    return { 
      success: true, 
      url: `https://hubqa-media.example.com/${Date.now()}-${file.originalname}` 
    };
  }
}
