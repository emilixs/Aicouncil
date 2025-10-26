import { IsString, IsNotEmpty, MinLength, MaxLength, IsEnum, IsObject, ValidateNested } from 'class-validator';
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
  @IsEnum(DriverType)
  driverType: DriverType;

  /**
   * Driver-specific configuration (model, temperature, maxTokens, etc.)
   */
  @IsObject()
  @ValidateNested()
  @Type(() => LLMConfig)
  config: LLMConfig;
}

