import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class CreateMemoryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(10000)
  content: string;
}
