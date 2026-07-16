import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  Body,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  // 16MB cap = WhatsApp's most permissive media limit; prevents disk abuse
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 16 * 1024 * 1024 } }),
  )
  async uploadFile(
    @Request() req: any,
    @UploadedFile() file: any,
    @Body('connectionId') connectionId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('يرجى إرفاق ملف');
    }

    // If connectionId is provided, upload directly to WhatsApp
    if (connectionId) {
      return this.mediaService.uploadToWhatsApp(
        req.user.tenantId,
        connectionId,
        file,
      );
    }

    // Otherwise, handle local/S3 upload
    return this.mediaService.uploadLocalFile(file);
  }
}
