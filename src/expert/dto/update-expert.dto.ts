import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateExpertDto } from './create-expert.dto';
import { UpdateLlmConfigDto } from '../../llm/dto';

class UpdateExpertDtoBase extends PartialType(
  OmitType(CreateExpertDto, ['config'] as const)
) {}

export class UpdateExpertDto extends UpdateExpertDtoBase {
  /**
   * Driver-specific configuration (model, temperature, maxTokens, etc.)
   * Override to allow partial updates to nested config
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateLlmConfigDto)
  config?: UpdateLlmConfigDto;
}

