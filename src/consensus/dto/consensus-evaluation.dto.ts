import { Expose } from 'class-transformer';

export interface ConsensusEvaluationResult {
  convergenceScore: number;
  consensusReached: boolean;
  areasOfAgreement: string[];
  areasOfDisagreement: string[];
  progressAssessment: 'converging' | 'stalled' | 'diverging';
  reasoning: string;
}

export class ConsensusEvaluationResponseDto {
  @Expose()
  id: string;

  @Expose()
  sessionId: string;

  @Expose()
  roundNumber: number;

  @Expose()
  convergenceScore: number;

  @Expose()
  consensusReached: boolean;

  @Expose()
  areasOfAgreement: string[];

  @Expose()
  areasOfDisagreement: string[];

  @Expose()
  progressAssessment: string;

  @Expose()
  reasoning: string;

  @Expose()
  evaluatedAt: Date;

  constructor(partial: Partial<ConsensusEvaluationResponseDto>) {
    Object.assign(this, partial);
  }
}
