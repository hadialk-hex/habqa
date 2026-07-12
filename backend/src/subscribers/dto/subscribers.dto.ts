import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsArray,
  Matches,
  IsEnum,
} from 'class-validator';
import { PlatformType } from '@prisma/client';

export class CreateSubscriberDto {
  @IsString()
  @IsNotEmpty({ message: 'الاسم مطلوب' })
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s\-()]{7,20}$/, { message: 'رقم الهاتف غير صالح' })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email?: string;

  @IsOptional()
  @IsArray({ message: 'الوسوم يجب أن تكون مصفوفة' })
  @IsString({ each: true, message: 'كل وسم يجب أن يكون نصاً' })
  tags?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(PlatformType, { message: 'نوع المنصة غير صالح' })
  platform?: PlatformType;
}

export class UpdateSubscriberDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'الاسم لا يمكن أن يكون فارغاً' })
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s\-()]{7,20}$/, { message: 'رقم الهاتف غير صالح' })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email?: string;

  @IsOptional()
  @IsArray({ message: 'الوسوم يجب أن تكون مصفوفة' })
  @IsString({ each: true, message: 'كل وسم يجب أن يكون نصاً' })
  tags?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(PlatformType, { message: 'نوع المنصة غير صالح' })
  platform?: PlatformType;
}
