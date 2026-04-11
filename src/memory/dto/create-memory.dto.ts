import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class MemoryMetadataDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topics?: string[];
}

export class CreateMemoryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  relevance?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => MemoryMetadataDto)
  metadata?: MemoryMetadataDto;
}
