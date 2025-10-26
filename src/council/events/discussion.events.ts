import { MessageResponseDto } from '../../message/dto/message-response.dto';

/**
 * Discussion event names
 */
export const DISCUSSION_EVENTS = {
  MESSAGE_CREATED: 'discussion.message.created',
  CONSENSUS_REACHED: 'discussion.consensus.reached',
  SESSION_ENDED: 'discussion.session.ended',
  ERROR: 'discussion.error',
  EXPERT_TURN_START: 'discussion.expert.turn.start',
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
  finalMessage: MessageResponseDto;
}

/**
 * Event emitted when a discussion session ends
 */
export interface DiscussionEndedEvent {
  sessionId: string;
  consensusReached: boolean;
  reason: 'consensus' | 'max_messages' | 'cancelled';
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
}

