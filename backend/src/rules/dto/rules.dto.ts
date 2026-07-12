import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  MaxLength,
} from 'class-validator';

export class CreateRuleDto {
  @IsString()
  @IsOptional()
  connectionId?: string;

  @IsString()
  @IsOptional()
  postId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  triggerType: string;

  @IsString()
  @IsOptional()
  keywords?: string;

  @IsString()
  @IsOptional()
  matchType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  replyText?: string;

  @IsOptional()
  replyMedia?: any;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  privateText?: string;

  @IsOptional()
  privateMedia?: any;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // triggerCount / lastTriggeredAt are server-managed statistics —
  // deliberately NOT accepted from clients (whitelist strips them)
  @IsOptional()
  replyMessages?: any;
}

export class UpdateRuleDto {
  @IsString()
  @IsOptional()
  connectionId?: string;

  @IsString()
  @IsOptional()
  postId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  triggerType?: string;

  @IsString()
  @IsOptional()
  keywords?: string;

  @IsString()
  @IsOptional()
  matchType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  replyText?: string;

  @IsOptional()
  replyMedia?: any;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  privateText?: string;

  @IsOptional()
  privateMedia?: any;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // triggerCount / lastTriggeredAt are server-managed statistics —
  // deliberately NOT accepted from clients (whitelist strips them)
  @IsOptional()
  replyMessages?: any;
}
