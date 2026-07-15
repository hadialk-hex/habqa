import {
  Module,
  NestModule,
  MiddlewareConsumer,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ChannelsModule } from './channels/channels.module';
import { RulesModule } from './rules/rules.module';
import { InboxModule } from './inbox/inbox.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SubscribersModule } from './subscribers/subscribers.module';
import { TeamModule } from './team/team.module';
import { BroadcastsModule } from './broadcasts/broadcasts.module';
import { AdminModule } from './admin/admin.module';
import { SettingsModule } from './settings/settings.module';
import { MailModule } from './mail/mail.module';
import { AiModule } from './ai/ai.module';
import { FlowsModule } from './flows/flows.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    SettingsModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST');
        if (redisHost) {
          const port = configService.get<number>('REDIS_PORT') || 6379;
          const password = configService.get<string>('REDIS_PASSWORD');
          const store = await redisStore({
            socket: { host: redisHost, port: Number(port) },
            ...(password ? { password } : {}),
          });
          return { store };
        }
        // Fallback: in-memory cache for local dev
        return { ttl: 60 };
      },
      isGlobal: true,
    }),
    ...(process.env.REDIS_HOST
      ? [
          BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
              connection: {
                host: configService.get<string>('REDIS_HOST') || 'localhost',
                port: Number(configService.get<number>('REDIS_PORT') || 6379),
                ...(configService.get<string>('REDIS_PASSWORD')
                  ? { password: configService.get<string>('REDIS_PASSWORD') }
                  : {}),
              },
            }),
          }),
        ]
      : []),
    ThrottlerModule.forRoot([
      {
        ttl: 10000,
        limit: process.env.NODE_ENV === 'test' ? 999999 : 15,
      },
    ]),
    PrismaModule,
    AuthModule,
    ChannelsModule,
    RulesModule,
    InboxModule,
    WebhooksModule,
    DashboardModule,
    SubscribersModule,
    TeamModule,
    BroadcastsModule,
    AdminModule,
    MailModule,
    AiModule,
    FlowsModule,
    NotificationsModule,
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, transform: true }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req: any, res: any, next: () => void) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        if (process.env.NODE_ENV === 'production') {
          res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        next();
      })
      .forRoutes('*');
  }
}
