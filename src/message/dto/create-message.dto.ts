import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  MinLength,
  MaxLength,
} from 'class-validator';
import { MessageRole } from '@prisma/client';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(10000)
  content: string;

  @IsOptional()
  @IsString()
  expertId?: string;

  @IsEnum(MessageRole)
  role: MessageRole;

  @IsOptional()
  @IsBoolean()
  isIntervention?: boolean;

  @IsOptional()
  @IsInt()
  roundNumber?: number;

  @IsOptional()
  @IsInt()
  promptTokens?: number;

  @IsOptional()
  @IsInt()
  completionTokens?: number;

  @IsOptional()
  @IsInt()
  totalTokens?: number;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  responseTimeMs?: number;

  @IsOptional()
  @IsString()
  finishReason?: string;
}
