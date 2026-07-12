import { IsOptional, IsString, Matches } from 'class-validator';

export class GetAnalyticsDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Start date must be YYYY-MM-DD format',
  })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'End date must be YYYY-MM-DD format',
  })
  endDate?: string;

  @IsOptional()
  @IsString()
  connectionId?: string;
}

export class GetStatsDto {
  @IsOptional()
  @IsString()
  range?: 'today' | '7days' | '30days' | 'custom';

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Start date must be YYYY-MM-DD format',
  })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'End date must be YYYY-MM-DD format',
  })
  endDate?: string;
}
