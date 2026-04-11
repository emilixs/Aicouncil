import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { MessageRole } from '@prisma/client';

export class CreateMessageDto {
  /**
   * The session ID the message belongs to
   */
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  /**
   * The message content
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(10000)
  content: string;

  /**
   * The expert ID (null for user interventions)
   */
  @IsOptional()
  @IsString()
  expertId?: string;

  /**
   * Message role - valid values: USER, ASSISTANT, SYSTEM
   */
  @IsEnum(MessageRole)
  role: MessageRole;

  /**
   * Marks user interventions (defaults to false in database)
   */
  @IsOptional()
  @IsBoolean()
  isIntervention?: boolean;

  /**
   * Response duration in milliseconds (comparison mode)
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMs?: number;

  /**
   * Total token count from LLM response (comparison mode)
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  tokenCount?: number;

  /**
   * Model identifier used for this response (comparison mode)
   */
  @IsOptional()
  @IsString()
  modelUsed?: string;
}
