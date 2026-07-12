import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AddConnectionDto {
  @IsString()
  @IsNotEmpty()
  platform: string;

  @IsString()
  @IsNotEmpty()
  platformId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  accessToken?: string;
}
