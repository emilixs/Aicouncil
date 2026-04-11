import type { ExpertResponse } from './expert';

export enum SessionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

export enum MessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
  SYSTEM = 'SYSTEM',
}

export enum SessionType {
  DISCUSSION = 'DISCUSSION',
  COMPARISON = 'COMPARISON',
}

export interface CreateSessionDto {
  problemStatement: string;
  expertIds: string[];
  maxMessages?: number;
  type?: SessionType;
}

export interface SessionResponse {
  id: string;
  problemStatement: string;
  status?: SessionStatus;
  statusDisplay?: string;
  type?: SessionType;
  maxMessages: number;
  consensusReached: boolean;
  createdAt: string;
  updatedAt: string;
  experts: ExpertResponse[];
  messageCount?: number;
}

export interface MessageResponse {
  id: string;
  sessionId: string;
  expertId: string | null;
  content: string;
  role: MessageRole;
  isIntervention: boolean;
  timestamp: string;
  expertName: string | null;
  expertSpecialty: string | null;
  durationMs?: number | null;
  tokenCount?: number | null;
  modelUsed?: string | null;
}

export interface TokenResponse {
  token: string;
}
