import { Expose } from 'class-transformer';
import { ConsensusEvaluationResult } from './consensus-evaluation.dto';

export interface DiscussionSummary {
  executiveSummary: string;
  decisions: string[];
  actionItems: Array<{
    description: string;
    priority: 'high' | 'medium' | 'low';
    suggestedOwner?: string;
  }>;
  keyArguments: Array<{
    expertName: string;
    position: string;
  }>;
  openQuestions: string[];
  finalEvaluation?: ConsensusEvaluationResult;
}

export class DiscussionOutcomeResponseDto {
  @Expose()
  id: string;

  @Expose()
  sessionId: string;

  @Expose()
  executiveSummary: string;

  @Expose()
  decisions: string[];

  @Expose()
  actionItems: Array<{
    description: string;
    priority: string;
    suggestedOwner?: string;
  }>;

  @Expose()
  keyArguments: Array<{
    expertName: string;
    position: string;
  }>;

  @Expose()
  openQuestions: string[];

  @Expose()
  finalEvaluation: ConsensusEvaluationResult | null;

  @Expose()
  generatedAt: Date;

  @Expose()
  generatedBy: string | null;

  constructor(partial: Partial<DiscussionOutcomeResponseDto>) {
    Object.assign(this, partial);
  }
}
