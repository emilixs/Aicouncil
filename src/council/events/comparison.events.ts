import { MessageResponseDto } from '../../message/dto/message-response.dto';

/**
 * Comparison event names
 */
export const COMPARISON_EVENTS = {
  RESPONSE_RECEIVED: 'comparison.response.received',
  ALL_RESPONSES_RECEIVED: 'comparison.all.received',
  COMPARISON_ERROR: 'comparison.error',
} as const;

/**
 * Event emitted when a single expert's comparison response is received
 */
export interface ComparisonResponseEvent {
  sessionId: string;
  message: MessageResponseDto;
  completedCount: number;
  totalExperts: number;
}

/**
 * Event emitted when all expert responses have been received
 */
export interface ComparisonAllReceivedEvent {
  sessionId: string;
  messages: MessageResponseDto[];
  totalDurationMs: number;
}

/**
 * Event emitted when an expert fails during comparison
 */
export interface ComparisonErrorEvent {
  sessionId: string;
  expertId: string;
  expertName: string;
  error: string;
}
