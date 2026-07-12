import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsString,
  IsOptional,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'الاسم مطلوب' })
  name: string;

  @IsString()
  @MinLength(6, { message: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'اسم مساحة العمل (Tenant) مطلوب' })
  tenantName: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  password: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل' })
  password?: string;
}

export class RequestPasswordResetDto {
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8, { message: 'الرمز غير صالح' })
  token: string;

  @IsString()
  @MinLength(6, { message: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل' })
  password: string;
}
