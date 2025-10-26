import { PartialType } from '@nestjs/mapped-types';
import { LLMConfig } from './llm-config.dto';

/**
 * Update LLM Configuration DTO
 * 
 * Allows partial updates to LLM configuration.
 * All fields from LLMConfig are optional in this DTO.
 */
export class UpdateLlmConfigDto extends PartialType(LLMConfig) {}

