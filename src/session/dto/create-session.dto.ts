import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';

/**
 * Data Transfer Object for creating a new session.
 * Validates the problem statement and expert participation requirements.
 */
export class CreateSessionDto {
  /**
   * The problem or question posed to the expert council.
   * Must be between 10 and 5000 characters to ensure meaningful problems.
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  problemStatement: string;

  /**
   * Array of expert IDs who will participate in the discussion.
   * Requires at least 2 experts for meaningful discussion.
   * Maximum of 10 experts to keep discussions manageable.
   */
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  expertIds: string[];

  /**
   * Optional maximum number of messages allowed in the session.
   * Defaults to 20 in the database if not specified.
   * Must be between 5 and 100 messages.
   */
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(100)
  maxMessages?: number;
}

