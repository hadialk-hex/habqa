import {
  IsEmail,
  IsEnum,
  IsString,
  MinLength,
  IsNotEmpty,
} from 'class-validator';
export enum TenantRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  AGENT = 'AGENT',
  VIEWER = 'VIEWER',
}

export class InviteMemberDto {
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email: string;

  @IsEnum(TenantRole, { message: 'الصلاحية غير صالحة' })
  role: TenantRole;
}

export class UpdateMemberRoleDto {
  @IsEnum(TenantRole, { message: 'الصلاحية غير صالحة' })
  role: TenantRole;
}

export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(6, { message: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل' })
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}
