import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsEnum,
  IsObject,
  ValidateNested,
  IsDefined,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DriverType } from '@prisma/client';
import { LLMConfig } from '../../llm/dto';

export class CreateExpertDto {
  /**
   * The expert's display name
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  /**
   * The expert's area of expertise (e.g., "Software Architecture", "Security Expert")
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  specialty: string;

  /**
   * The system prompt that defines the expert's behavior and personality in discussions
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  systemPrompt: string;

  /**
   * The LLM driver type to use for this expert
   * Valid values: OPENAI, ANTHROPIC
   */
  @IsDefined()
  @IsEnum(DriverType)
  driverType: DriverType;

  /**
   * Driver-specific configuration (model, temperature, maxTokens, etc.)
   */
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => LLMConfig)
  config: LLMConfig;

  @IsOptional()
  @IsBoolean()
  memoryEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  memoryMaxEntries?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  memoryMaxInject?: number;
}
