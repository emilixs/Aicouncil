import { Expose } from 'class-transformer';
import { SessionStatus, Session, SessionExpert, Expert } from '@prisma/client';
import { ExpertResponseDto } from '../../expert/dto';

/**
 * Data Transfer Object for session responses.
 * Includes session data with participating experts and message count.
 */
export class SessionResponseDto {
  /**
   * Unique identifier for the session
   */
  @Expose()
  id: string;

  /**
   * The problem or question posed to the expert council
   */
  @Expose()
  problemStatement: string;

  /**
   * Current session state (PENDING, ACTIVE, COMPLETED, CANCELLED)
   */
  @Expose()
  status: SessionStatus;

  /**
   * Maximum number of messages allowed in this session
   */
  @Expose()
  maxMessages: number;

  /**
   * Whether the expert council has reached consensus
   */
  @Expose()
  consensusReached: boolean;

  /**
   * Timestamp when the session was created
   */
  @Expose()
  createdAt: Date;

  /**
   * Timestamp when the session was last updated
   */
  @Expose()
  updatedAt: Date;

  /**
   * Array of experts participating in this session
   */
  @Expose()
  experts: ExpertResponseDto[];

  /**
   * Total number of messages in the session (optional, useful for UI)
   */
  @Expose()
  messageCount?: number;

  constructor(partial: Partial<SessionResponseDto>) {
    Object.assign(this, partial);
  }

  /**
   * Factory method to create SessionResponseDto from Prisma entity.
   * Transforms SessionExpert relations to ExpertResponseDto array.
   *
   * @param session - Prisma Session entity with included experts and optional message count
   * @returns SessionResponseDto instance
   */
  static fromPrisma(
    session: Session & {
      experts: Array<SessionExpert & { expert: Expert }>;
      _count?: { messages: number };
    },
  ): SessionResponseDto {
    return new SessionResponseDto({
      id: session.id,
      problemStatement: session.problemStatement,
      status: session.status,
      maxMessages: session.maxMessages,
      consensusReached: session.consensusReached,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      experts: session.experts.map((se) =>
        ExpertResponseDto.fromPrisma(se.expert),
      ),
      messageCount: session._count?.messages,
    });
  }
}

