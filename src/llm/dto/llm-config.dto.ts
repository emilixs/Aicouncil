import { IsString, IsOptional, IsNumber, Min, Max, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * LLM Configuration DTO
 * 
 * Represents driver-specific configuration stored in the Expert model's config JSON field.
 * Each driver implementation will extract relevant fields and apply defaults for missing optional values.
 */
export class LLMConfig {
  /**
   * Model identifier (e.g., 'gpt-4', 'claude-3-5-sonnet-20241022')
   */
  @IsString()
  model: string;

  /**
   * Sampling temperature (0-2 for OpenAI, 0-1 for Anthropic)
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  /**
   * Maximum tokens to generate
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxTokens?: number;

  /**
   * Nucleus sampling parameter
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  topP?: number;

  /**
   * Stop sequences
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stop?: string[];
}

