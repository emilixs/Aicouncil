import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsNumber,
  IsObject,
  Min,
  Max,
} from 'class-validator';

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
  metadata?: Record<string, any>;
}
