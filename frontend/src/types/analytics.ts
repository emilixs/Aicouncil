export interface OverviewStats {
  totalSessions: number;
  completedSessions: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  estimatedCostUsd: number;
  avgRoundsToConsensus: number;
}

export interface SessionAnalytics {
  sessionId: string;
  problemStatement: string;
  status: string;
  totalTokens: number;
  totalRounds: number;
  estimatedCostUsd: number;
  consensusReached: boolean;
  durationMs: number;
  createdAt: string;
}

export interface SessionDetailMetrics {
  sessionId: string;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalRounds: number;
  totalMessages: number;
  totalInterventions: number;
  durationMs: number;
  avgResponseTimeMs: number;
  estimatedCostUsd: number;
}

export interface SessionExpertBreakdown {
  expertId: string;
  totalTokens: number;
  messageCount: number;
  avgResponseTimeMs: number;
}

export interface SessionDetailAnalytics {
  metrics: SessionDetailMetrics;
  perExpert: SessionExpertBreakdown[];
}

export interface ExpertStats {
  expertId: string;
  name: string;
  specialty: string;
  totalSessions: number;
  avgTokensPerMessage: number;
  consensusRate: number;
}

export interface ExpertDetailAnalytics {
  expertId: string;
  name: string;
  specialty: string;
  totalSessions: number;
  sessions: {
    sessionId: string;
    status: string;
  }[];
}

export interface ComparisonStats {
  expertCombination: string[];
  sessionCount: number;
  avgRounds: number;
  consensusRate: number;
  avgTotalTokens: number;
}

export interface DateRangeFilter {
  from?: string;
  to?: string;
}
