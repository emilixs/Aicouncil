import { Expose } from 'class-transformer';
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class CreatePollDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  proposal: string;
}

export interface PollVoteResult {
  vote: 'agree' | 'disagree' | 'agree_with_reservations';
  reasoning: string;
}

export class PollVoteResponseDto {
  @Expose()
  id: string;

  @Expose()
  pollId: string;

  @Expose()
  expertId: string;

  @Expose()
  expertName?: string;

  @Expose()
  vote: string;

  @Expose()
  reasoning: string;

  @Expose()
  createdAt: Date;

  constructor(partial: Partial<PollVoteResponseDto>) {
    Object.assign(this, partial);
  }
}

export class PollResponseDto {
  @Expose()
  id: string;

  @Expose()
  sessionId: string;

  @Expose()
  proposal: string;

  @Expose()
  createdBy: string;

  @Expose()
  status: string;

  @Expose()
  createdAt: Date;

  @Expose()
  closedAt: Date | null;

  @Expose()
  votes: PollVoteResponseDto[];

  constructor(partial: Partial<PollResponseDto>) {
    Object.assign(this, partial);
  }
}
