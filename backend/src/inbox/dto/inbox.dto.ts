import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Content is required' })
  content: string;
}

export class MarkReadDto {
  @IsBoolean()
  read: boolean;
}
