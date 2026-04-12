import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  MaxLength,
  IsNumber,
  IsObject,
  IsArray,
  Min,
  Max,
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
  @Min(0)
  @Max(1)
  relevance?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MemoryMetadataDto)
  metadata?: MemoryMetadataDto;
}
