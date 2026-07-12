import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateBroadcastDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Content cannot be empty' })
  content: string;

  @IsString()
  @IsNotEmpty({ message: 'Segment target is required' })
  segmentTarget: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

export class ScheduleBroadcastDto {
  @IsString()
  @IsNotEmpty({ message: 'Scheduled time is required' })
  scheduledAt: string;
}
