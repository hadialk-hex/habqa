import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
  HttpStatus,
  Query,
  HttpException,
} from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class HealthQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  simulateDbFailure?: boolean;
}

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth(@Query() query?: HealthQueryDto) {
    if (query?.simulateDbFailure === true) {
      throw new HttpException(
        {
          status: 'error',
          details: {
            database: {
              status: 'down',
            },
          },
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        details: {
          database: {
            status: 'up',
          },
        },
      };
    } catch (error: any) {
      throw new HttpException(
        {
          status: 'error',
          details: {
            database: {
              status: 'down',
              error: error.message,
            },
          },
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get('system/config-limits')
  getConfigLimits() {
    return {
      maxRulesPerTenant: 100,
      maxConnectionsPerTenant: 10,
    };
  }

  @Get('system/rate-limits')
  getRateLimits() {
    return {
      limit: 15,
      ttl: 10000,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put('tenants/:id')
  async updateTenant(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { name: string },
  ) {
    if (req.user.tenantId !== id) {
      throw new ForbiddenException('غير مصرح لك بتعديل هذه المؤسسة');
    }
    if (req.user.role !== 'OWNER' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'فقط المالك أو المدير يمكنه تعديل اسم مساحة العمل',
      );
    }
    if (!body.name || body.name.trim() === '') {
      throw new BadRequestException('الاسم مطلوب');
    }
    return this.prisma.tenant.update({
      where: { id },
      data: { name: body.name.trim() },
    });
  }
}
