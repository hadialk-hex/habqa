import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelsService } from '../channels/channels.service';
import { uploadWhatsAppMedia } from '../common/graph-api-client';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

// Only media types Meta accepts as message attachments
const ALLOWED_MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'application/pdf': '.pdf',
};

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
    if (conn.platform !== 'WHATSAPP')
      throw new BadRequestException('القناة ليست واتساب');
    if (!conn.platformId)
      throw new BadRequestException('معرف المنصة غير موجود');

    if (!conn.accessToken)
      throw new BadRequestException('تحتاج لتسجيل الدخول مجدداً');

    const token = this.channelsService.getDecryptedAccessToken(
      conn.accessToken,
    );
    if (!token) throw new BadRequestException('تحتاج لتسجيل الدخول مجدداً');

    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');

    const blob = new Blob([file.buffer], { type: file.mimetype });
    formData.append('file', blob, file.originalname);

    const res = await uploadWhatsAppMedia(conn.platformId, formData, token);
    if (!res.ok) {
      throw new BadRequestException(
        res.error?.message || 'فشل رفع الملف إلى واتساب',
      );
    }

    return { success: true, mediaId: res.data?.id };
  }

  // Stores the file on local disk (backend/uploads, served statically at
  // /uploads by main.ts) and returns a public URL Meta can fetch. The name is
  // random — never trust the client-supplied filename on disk.
  async uploadLocalFile(file: any) {
    const ext = ALLOWED_MIME_EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        'نوع الملف غير مدعوم. المسموح: صور (jpg/png/gif/webp)، فيديو mp4، صوت mp3/ogg، PDF.',
      );
    }

    const uploadsDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const name = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    await fs.writeFile(path.join(uploadsDir, name), file.buffer);

    // Public base: the app's own domain (the Next proxy forwards
    // /api/backend/* to this server), overridable via PUBLIC_MEDIA_BASE.
    const base =
      process.env.PUBLIC_MEDIA_BASE ||
      (process.env.FRONTEND_URL
        ? `${process.env.FRONTEND_URL}/api/backend`
        : '');
    return { success: true, url: `${base}/uploads/${name}` };
  }
}
