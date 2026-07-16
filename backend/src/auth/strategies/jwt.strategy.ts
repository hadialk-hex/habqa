import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is missing');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const revoked = await this.prisma.revokedToken.findUnique({
        where: { token },
      });
      if (revoked) {
        throw new UnauthorizedException();
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    // Password changes invalidate old tokens via the pwSig check below.
    // (Deliberately NOT comparing iat with updatedAt: profile edits and
    // email verification bump updatedAt and would log the user out.)
    if (payload.pwSig !== undefined) {
      const currentSig = user.password ? user.password.slice(-8) : '';
      if (payload.pwSig !== currentSig) {
        throw new UnauthorizedException('Token is no longer valid');
      }
    }

    const member = await this.prisma.tenantMember.findFirst({
      where: {
        userId: user.id,
        tenantId: payload.tenantId,
      },
      include: {
        tenant: {
          select: { isSuspended: true },
        },
      },
    });

    if (!member) {
      throw new UnauthorizedException();
    }

    if (member.tenant?.isSuspended && !user.isSuperAdmin) {
      throw new UnauthorizedException(
        'تم إيقاف هذا الحساب من قبل إدارة المنصة',
      );
    }

    return {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      role: member.role,
      isSuperAdmin: user.isSuperAdmin,
    };
  }
}
