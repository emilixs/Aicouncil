import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class UpdateMemoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  relevance?: number;
}
