import { MessageResponseDto } from '../../message/dto/message-response.dto';

/**
 * Discussion event names
 */
export const DISCUSSION_EVENTS = {
  MESSAGE_CREATED: 'discussion.message.created',
  CONSENSUS_REACHED: 'discussion.consensus.reached',
  SESSION_ENDED: 'discussion.session.ended',
  SESSION_PAUSED: 'discussion.session.paused',
  SESSION_RESUMED: 'discussion.session.resumed',
  DISCUSSION_STOPPED: 'discussion.stopped',
  ERROR: 'discussion.error',
  EXPERT_TURN_START: 'discussion.expert.turn.start',
  CONSENSUS_EVALUATION: 'discussion.consensus.evaluation',
  DISCUSSION_SUMMARY: 'discussion.summary',
  DISCUSSION_STALLED: 'discussion.stalled',
  POLL_CREATED: 'discussion.poll.created',
  POLL_VOTE: 'discussion.poll.vote',
  POLL_CLOSED: 'discussion.poll.closed',
} as const;

/**
 * Event emitted when a new message is created during discussion
 */
export interface DiscussionMessageEvent {
  sessionId: string;
  message: MessageResponseDto;
}

/**
 * Event emitted when consensus is reached
 */
export interface DiscussionConsensusEvent {
  sessionId: string;
  consensusReached: boolean;
  finalMessage: MessageResponseDto | null;
}

/**
 * Event emitted when a discussion session ends
 */
export interface DiscussionEndedEvent {
  sessionId: string;
  consensusReached: boolean;
  reason: 'consensus' | 'max_messages' | 'cancelled' | 'stalled';
  messageCount: number;
}

/**
 * Event emitted when an error occurs during discussion
 */
export interface DiscussionErrorEvent {
  sessionId: string;
  error: string;
  expertId?: string;
}

/**
 * Event emitted when an expert's turn starts
 */
export interface ExpertTurnStartEvent {
  sessionId: string;
  expertId: string;
  expertName: string;
  turnNumber: number;
  injectedMemoryIds: string[];
}

/**
 * Event emitted when a discussion is paused
 */
export interface DiscussionPausedEvent {
  sessionId: string;
}

/**
 * Event emitted when a discussion is resumed
 */
export interface DiscussionResumedEvent {
  sessionId: string;
}

/**
 * Event emitted immediately when a stop is requested (before loop exits)
 */
export interface DiscussionStoppedEvent {
  sessionId: string;
}

export interface ConsensusEvaluationEvent {
  sessionId: string;
  evaluation: {
    id: string;
    convergenceScore: number;
    consensusReached: boolean;
    areasOfAgreement: string[];
    areasOfDisagreement: string[];
    progressAssessment: string;
    reasoning: string;
  };
}

export interface DiscussionSummaryEvent {
  sessionId: string;
  outcome: {
    id: string;
    executiveSummary: string;
    decisions: string[];
    actionItems: any[];
    keyArguments: any[];
    openQuestions: string[];
  };
}

export interface DiscussionStalledEvent {
  sessionId: string;
  stalledRounds: number;
}

export interface PollCreatedEvent {
  sessionId: string;
  pollId: string;
  proposal: string;
}

export interface PollVoteEvent {
  sessionId: string;
  pollId: string;
  expertId: string;
  expertName: string;
  vote: string;
  reasoning: string;
}

export interface PollClosedEvent {
  sessionId: string;
  pollId: string;
  results: {
    agree: number;
    disagree: number;
    agreeWithReservations: number;
  };
}
