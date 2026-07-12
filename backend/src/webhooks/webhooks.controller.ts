import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  Req,
  Headers,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import type { Response } from 'express';
import * as crypto from 'crypto';
import { SkipThrottle } from '@nestjs/throttler';
import { Optional } from '@nestjs/common';

@SkipThrottle()
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly prisma: PrismaService,
    @Optional() private readonly platformSettings?: PlatformSettingsService,
  ) {}

  @Get()
  async verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    try {
      const verifiedChallenge = await this.webhooksService.verifyWebhook(
        mode,
        token,
        challenge,
      );
      return res.status(HttpStatus.OK).send(verifiedChallenge);
    } catch (error) {
      return res.status(HttpStatus.FORBIDDEN).send('Verification Failed');
    }
  }

  @Post()
  async handleIncomingEvent(
    @Req() req: any,
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: any,
    @Res() res: Response,
  ) {
    // Meta signs webhooks with the app secret — admin-panel value wins,
    // env vars (FACEBOOK_APP_SECRET or legacy APP_SECRET) as fallback
    const appSecret =
      (await this.platformSettings?.get('FACEBOOK_APP_SECRET')) ||
      process.env.FACEBOOK_APP_SECRET ||
      process.env.APP_SECRET;
    if (!appSecret) {
      throw new UnauthorizedException('App secret is not configured');
    }

    if (!signature || !signature.startsWith('sha256=')) {
      throw new UnauthorizedException(
        'Signature header is missing or malformed',
      );
    }

    const signatureHash = signature.slice(7);
    const rawBody = req.rawBody;

    if (!rawBody) {
      throw new UnauthorizedException('Raw body is missing');
    }

    const expectedHash = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    let isMatch = false;
    try {
      isMatch = crypto.timingSafeEqual(
        Buffer.from(signatureHash, 'hex'),
        Buffer.from(expectedHash, 'hex'),
      );
    } catch {
      isMatch = false;
    }

    if (!isMatch) {
      throw new UnauthorizedException('Invalid signature');
    }

    if (!body || Object.keys(body).length === 0) {
      throw new BadRequestException('Payload is empty');
    }

    if (requestId) {
      const duplicate = await this.prisma.webhookDeduplication.findUnique({
        where: { eventId: requestId },
      });
      if (duplicate) {
        return res.status(HttpStatus.OK).send('EVENT_RECEIVED');
      }
      const platform =
        body?.object === 'whatsapp_business_account' ? 'WHATSAPP' : 'FACEBOOK';
      await this.prisma.webhookDeduplication.create({
        data: {
          eventId: requestId,
          platform,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });
    }

    // Process event synchronously to ensure DB writes commit before response
    try {
      await this.webhooksService.handleIncomingEvent(body);
    } catch (error) {
      console.error('Error processing webhook:', error);
    }

    // Return 200 OK to Meta
    res.status(HttpStatus.OK).send('EVENT_RECEIVED');
  }
}
