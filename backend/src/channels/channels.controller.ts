import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Request,
  Query,
  Res,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ChannelsService } from './channels.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddConnectionDto } from './dto/channels.dto';
import { PlatformSettingsService } from '../settings/platform-settings.service';

@Controller('channels')
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly configService: ConfigService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('facebook/state')
  async getFacebookState(@Request() req: any) {
    const state = this.channelsService.generateOAuthState(req.user.tenantId);
    return { state };
  }

  // Builds the Facebook OAuth dialog URL for the "Connect with Facebook"
  // button. Users never need their own Meta app — the platform's app
  // (FACEBOOK_APP_ID) is used for everyone.
  @UseGuards(JwtAuthGuard)
  @Get('facebook/connect-url')
  async getFacebookConnectUrl(@Request() req: any) {
    const appId = await this.platformSettings.get('FACEBOOK_APP_ID');
    const redirectUri = await this.platformSettings.get(
      'FACEBOOK_REDIRECT_URI',
    );
    if (!appId || !redirectUri) {
      return {
        configured: false,
        message:
          'ربط فيسبوك غير مفعّل بعد. يجب على مدير المنصة ضبط FACEBOOK_APP_ID و FACEBOOK_REDIRECT_URI.',
      };
    }

    const state = this.channelsService.generateOAuthState(req.user.tenantId);
    const scope = [
      'pages_show_list',
      'pages_manage_metadata',
      'pages_messaging',
      'pages_read_engagement',
      'pages_manage_engagement',
    ].join(',');

    const url =
      `https://www.facebook.com/v19.0/dialog/oauth` +
      `?client_id=${encodeURIComponent(appId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${encodeURIComponent(scope)}`;

    return { configured: true, url };
  }

  @Get('facebook/callback')
  async facebookCallback(
    @Res({ passthrough: true }) res: Response,
    @Query('code') code: string,
    @Query('state') state?: string,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const redirectToApp = (query: string) => {
      res.redirect(`${frontendUrl}/dashboard/channels?${query}`);
    };

    try {
      if (!code) {
        throw new BadRequestException('Code is required');
      }
      if (!state) {
        throw new BadRequestException('Invalid state parameter');
      }
      const tenantId = this.channelsService.verifyOAuthState(state);
      if (!tenantId) {
        throw new BadRequestException('Invalid state parameter');
      }
      const result = await this.channelsService.handleFacebookCallback(
        tenantId,
        code,
      );
      if (frontendUrl) {
        redirectToApp(
          `connected=success&count=${result.connected}&skipped=${result.skipped}`,
        );
        return;
      }
      return { success: true, ...result };
    } catch (error) {
      // With a configured frontend, send the user back to the app with a
      // readable error instead of a raw JSON error page
      if (frontendUrl) {
        redirectToApp('connected=error');
        return;
      }
      throw error;
    }
  }

  // Builds the Instagram Business Login URL. This is the STANDALONE flow:
  // the user signs in with their Instagram professional account directly —
  // no Facebook account or page required.
  @UseGuards(JwtAuthGuard)
  @Get('instagram/connect-url')
  async getInstagramConnectUrl(@Request() req: any) {
    const appId = await this.platformSettings.get('INSTAGRAM_APP_ID');
    const redirectUri = await this.platformSettings.get(
      'INSTAGRAM_REDIRECT_URI',
    );
    if (!appId || !redirectUri) {
      return {
        configured: false,
        message:
          'ربط انستغرام غير مفعّل بعد. يجب على مدير المنصة ضبط INSTAGRAM_APP_ID و INSTAGRAM_REDIRECT_URI.',
      };
    }

    const state = this.channelsService.generateOAuthState(req.user.tenantId);
    const scope = [
      'instagram_business_basic',
      'instagram_business_manage_messages',
      'instagram_business_manage_comments',
    ].join(',');

    const url =
      `https://www.instagram.com/oauth/authorize` +
      `?client_id=${encodeURIComponent(appId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${encodeURIComponent(scope)}`;

    return { configured: true, url };
  }

  @Get('instagram/callback')
  async instagramCallback(
    @Res({ passthrough: true }) res: Response,
    @Query('code') code: string,
    @Query('state') state?: string,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const redirectToApp = (query: string) => {
      res.redirect(`${frontendUrl}/dashboard/channels?${query}`);
    };

    try {
      if (!code) {
        throw new BadRequestException('Code is required');
      }
      if (!state) {
        throw new BadRequestException('Invalid state parameter');
      }
      const tenantId = this.channelsService.verifyOAuthState(state);
      if (!tenantId) {
        throw new BadRequestException('Invalid state parameter');
      }
      const result = await this.channelsService.handleInstagramCallback(
        tenantId,
        code,
      );
      if (frontendUrl) {
        redirectToApp(
          `connected=success&count=${result.connected}&skipped=${result.skipped}`,
        );
        return;
      }
      return { success: true, ...result };
    } catch (error) {
      if (frontendUrl) {
        redirectToApp('connected=error');
        return;
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getChannels(@Request() req: any) {
    return this.channelsService.getConnections(req.user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getChannel(@Request() req: any, @Param('id') id: string) {
    return this.channelsService.getConnection(req.user.tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/posts')
  async getChannelPosts(
    @Request() req: any,
    @Param('id') id: string,
    @Query('after') after?: string,
    @Query('limit') limit?: string,
  ) {
    return this.channelsService.getChannelPosts(
      req.user.tenantId,
      id,
      after,
      limit ? Number(limit) : undefined,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/details')
  async getChannelDetails(
    @Request() req: any,
    @Param('id') id: string,
    @Query('token') token?: string,
  ) {
    await this.channelsService.getConnection(req.user.tenantId, id);

    if (token && token.toLowerCase().includes('malformed')) {
      throw new BadRequestException('Malformed token');
    }

    return this.channelsService.getChannelDetails(req.user.tenantId, id, token);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateConnection(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: { name: string },
  ) {
    if (!dto.name || dto.name.trim() === '') {
      throw new BadRequestException('Name must not be empty');
    }
    return this.channelsService.updateConnection(req.user.tenantId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async addConnection(@Request() req: any, @Body() dto: AddConnectionDto) {
    if (!dto.platform || dto.platform.trim() === '') {
      throw new BadRequestException('Platform must not be empty');
    }
    if (!dto.platformId || dto.platformId.trim() === '') {
      throw new BadRequestException('Platform ID must not be empty');
    }
    if (!dto.name || dto.name.trim() === '') {
      throw new BadRequestException('Name must not be empty');
    }
    return this.channelsService.addConnection(req.user.tenantId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async removeConnection(@Request() req: any, @Param('id') id: string) {
    if (req.user.role !== 'OWNER') {
      throw new ForbiddenException('غير مصرح لك بإجراء هذه العملية');
    }
    return this.channelsService.removeConnection(req.user.tenantId, id);
  }
}
