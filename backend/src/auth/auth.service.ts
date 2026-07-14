import {
  Injectable,
  Optional,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto, LoginDto, ResetPasswordDto } from './dto/auth.dto';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    @Optional() private mailService?: MailService,
  ) {}

  private resetRequests = new Map<string, number[]>();

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('البريد الإلكتروني مستخدم بالفعل');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        memberships: {
          create: {
            role: 'OWNER',
            tenant: {
              create: {
                name: dto.tenantName,
                plan: 'STARTER',
              },
            },
          },
        },
      },
      include: {
        memberships: {
          include: {
            tenant: true,
          },
        },
      },
    });

    // Kick off email verification (OTP) — non-blocking so registration
    // succeeds even when SMTP isn't configured
    try {
      await this.issueVerificationCode(user.id, user.email);
    } catch {
      // ignore — user can request a resend later
    }

    return this.generateToken(user);
  }

  // Generates a 6-digit code, stores it on the user, and emails it
  async issueVerificationCode(userId: string, email: string) {
    const code = crypto.randomInt(100000, 1000000).toString();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        verifyCode: code,
        verifyCodeExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    await this.mailService?.sendVerificationCode(email, code);
    return { message: 'تم إرسال رمز التفعيل إلى بريدك الإلكتروني' };
  }

  async resendVerificationCode(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    if (user.emailVerifiedAt) {
      return { message: 'البريد الإلكتروني مفعّل بالفعل', verified: true };
    }
    return this.issueVerificationCode(user.id, user.email);
  }

  async verifyEmail(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    if (user.emailVerifiedAt) {
      return { message: 'البريد الإلكتروني مفعّل بالفعل', verified: true };
    }
    if (
      !user.verifyCode ||
      !user.verifyCodeExpiresAt ||
      user.verifyCodeExpiresAt < new Date()
    ) {
      throw new BadRequestException(
        'انتهت صلاحية رمز التفعيل. اطلب رمزاً جديداً.',
      );
    }
    if (user.verifyCode !== code.trim()) {
      throw new BadRequestException('رمز التفعيل غير صحيح');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifiedAt: new Date(),
        verifyCode: null,
        verifyCodeExpiresAt: null,
      },
    });
    return { message: 'تم تفعيل بريدك الإلكتروني بنجاح', verified: true };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        memberships: {
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException(
        'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      );
    }

    return this.generateToken(user);
  }

  async logout(token: string) {
    if (!token) return;
    await this.prisma.revokedToken.upsert({
      where: { token },
      update: {},
      create: { token },
    });
  }

  async requestPasswordReset(email: string) {
    const now = Date.now();
    const times = this.resetRequests.get(email) || [];
    const oneMinuteAgo = now - 60000;
    const recentTimes = times.filter((t) => t > oneMinuteAgo);

    if (recentTimes.length >= 2) {
      throw new HttpException(
        'لقد تجاوزت الحد المسموح به لطلب إعادة تعيين كلمة المرور',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recentTimes.push(now);
    this.resetRequests.set(email, recentTimes);

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Security: always return success to prevent user enumeration
    if (!user) {
      return { message: 'إذا كان البريد مسجلاً، سيتم إرسال رابط إعادة التعيين' };
    }

    const token = 'reset_' + crypto.randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    await this.mailService?.sendPasswordReset(email, resetUrl);

    return { message: 'إذا كان البريد مسجلاً، سيتم إرسال رابط إعادة التعيين' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
      include: { user: true },
    });

    if (!resetToken) {
      throw new BadRequestException('الرمز غير صالح أو منتهي الصلاحية');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('انتهت صلاحية رمز إعادة التعيين');
    }

    if (resetToken.usedAt !== null) {
      throw new BadRequestException('تم استخدام رمز إعادة التعيين بالفعل');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'تم إعادة تعيين كلمة المرور بنجاح' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    // Never expose credential material to the client
    const {
      password: _password,
      verifyCode: _verifyCode,
      verifyCodeExpiresAt: _verifyCodeExpiresAt,
      ...safeUser
    } = user;
    return {
      ...safeUser,
      emailVerified: Boolean(user.emailVerifiedAt),
    };
  }

  async updateProfile(
    userId: string,
    name?: string,
    password?: string,
    currentPassword?: string,
  ) {
    const data: any = {};
    if (name !== undefined) {
      data.name = name;
    }
    if (password !== undefined) {
      // Require current password verification before allowing change
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user || !user.password) {
        throw new BadRequestException('المستخدم غير موجود أو لا يملك كلمة مرور');
      }
      if (!currentPassword) {
        throw new BadRequestException('يجب إدخال كلمة المرور الحالية للتحقق');
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        throw new BadRequestException('كلمة المرور الحالية غير صحيحة');
      }
      data.password = await bcrypt.hash(password, 10);
    }
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  private generateToken(user: any) {
    const primaryTenantId = user.memberships[0]?.tenantId;
    const role = user.memberships[0]?.role;

    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: primaryTenantId,
      role: role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenantId: primaryTenantId,
        tenantName: user.memberships[0]?.tenant?.name,
        role: role,
        isSuperAdmin: user.isSuperAdmin ?? false,
      },
    };
  }
}
