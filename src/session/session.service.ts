import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SessionStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../common/prisma.service';
import {
  CreateSessionDto,
  UpdateSessionDto,
  SessionResponseDto,
} from './dto';

/**
 * Service layer for session business logic and database operations.
 * Manages session lifecycle, validates expert participation, and enforces status transitions.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create a new session with the specified experts.
   * Validates that all experts exist and that there are no duplicates.
   * Uses a transaction to ensure atomicity when creating session and expert associations.
   *
   * @param createSessionDto - Session creation data
   * @returns Created session with participating experts
   * @throws NotFoundException if any expert ID is invalid
   * @throws BadRequestException if there are duplicate expert IDs
   */
  async create(
    createSessionDto: CreateSessionDto,
  ): Promise<SessionResponseDto> {
    const { problemStatement, expertIds, maxMessages } = createSessionDto;

    // Validate that all expert IDs exist using a single batch query
    const existingExperts = await this.prisma.expert.findMany({
      where: { id: { in: expertIds } },
      select: { id: true },
    });

    const existingIds = new Set(existingExperts.map((expert) => expert.id));
    const invalidIds = expertIds.filter((id) => !existingIds.has(id));

    if (invalidIds.length > 0) {
      throw new NotFoundException(
        `The following expert IDs were not found: ${invalidIds.join(', ')}`,
      );
    }

    // Validate no duplicate expert IDs
    if (new Set(expertIds).size !== expertIds.length) {
      throw new BadRequestException(
        'Duplicate expert IDs are not allowed in a session',
      );
    }

    try {
      // Use transaction to create session and SessionExpert records atomically
      const session = await this.prisma.$transaction(async (tx) => {
        // Create the session
        const newSession = await tx.session.create({
          data: {
            problemStatement,
            maxMessages: maxMessages ?? undefined,
            status: SessionStatus.PENDING,
          },
        });

        // Create SessionExpert junction records
        await tx.sessionExpert.createMany({
          data: expertIds.map((expertId) => ({
            sessionId: newSession.id,
            expertId,
          })),
        });

        // Query the created session with included relations
        return await tx.session.findUnique({
          where: { id: newSession.id },
          include: {
            experts: {
              include: {
                expert: true,
              },
            },
          },
        });
      });

      if (!session) {
        throw new InternalServerErrorException(
          'Failed to create session with experts',
        );
      }

      this.logger.log(`Created session ${session.id} with ${expertIds.length} experts`);
      return SessionResponseDto.fromPrisma(session);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        this.logger.error(`Prisma error creating session: ${error.message}`, error.stack);
        throw new InternalServerErrorException('Failed to create session');
      }
      throw error;
    }
  }

  /**
   * Retrieve all sessions with their participating experts and message counts.
   * Sessions are ordered by creation date (newest first).
   *
   * @returns Array of all sessions with experts and message counts
   */
  async findAll(): Promise<SessionResponseDto[]> {
    const sessions = await this.prisma.session.findMany({
      include: {
        experts: {
          include: {
            expert: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sessions.map((session) => SessionResponseDto.fromPrisma(session));
  }

  /**
   * Retrieve a single session by ID with experts and message count.
   *
   * @param id - Session ID
   * @returns Session with experts and message count
   * @throws NotFoundException if session does not exist
   */
  async findOne(id: string): Promise<SessionResponseDto> {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        experts: {
          include: {
            expert: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    return SessionResponseDto.fromPrisma(session);
  }

  /**
   * Update a session's status or consensus flag.
   * Validates status transitions to ensure valid state machine progression.
   *
   * @param id - Session ID
   * @param updateSessionDto - Update data
   * @returns Updated session with experts and message count
   * @throws NotFoundException if session does not exist
   * @throws BadRequestException if status transition is invalid
   */
  async update(
    id: string,
    updateSessionDto: UpdateSessionDto,
  ): Promise<SessionResponseDto> {
    // Fetch current session to validate status transition
    const currentSession = await this.findOne(id);

    // Validate status transition if status is being updated
    if (
      updateSessionDto.status &&
      !this.validateStatusTransition(
        currentSession.status,
        updateSessionDto.status,
      )
    ) {
      const validTransitions = this.getValidTransitions(currentSession.status);
      throw new BadRequestException(
        `Invalid status transition from ${currentSession.status} to ${updateSessionDto.status}. ` +
          `Valid transitions from ${currentSession.status}: ${validTransitions.join(', ') || 'none (terminal state)'}`,
      );
    }

    try {
      const updatedSession = await this.prisma.session.update({
        where: { id },
        data: updateSessionDto,
        include: {
          experts: {
            include: {
              expert: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
      });

      this.logger.log(`Updated session ${id}: ${JSON.stringify(updateSessionDto)}`);
      return SessionResponseDto.fromPrisma(updatedSession);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Session with ID ${id} not found`);
        }
        this.logger.error(`Prisma error updating session: ${error.message}`, error.stack);
        throw new InternalServerErrorException('Failed to update session');
      }
      throw error;
    }
  }

  /**
   * Validate whether a status transition is allowed.
   * Implements the session state machine:
   * - PENDING → ACTIVE or CANCELLED
   * - ACTIVE → COMPLETED or CANCELLED
   * - COMPLETED → no transitions (terminal state)
   * - CANCELLED → no transitions (terminal state)
   *
   * @param currentStatus - Current session status
   * @param newStatus - Desired new status
   * @returns True if transition is valid, false otherwise
   */
  private validateStatusTransition(
    currentStatus: SessionStatus,
    newStatus: SessionStatus,
  ): boolean {
    // No transition needed if status is the same
    if (currentStatus === newStatus) {
      return true;
    }

    switch (currentStatus) {
      case SessionStatus.PENDING:
        return (
          newStatus === SessionStatus.ACTIVE ||
          newStatus === SessionStatus.CANCELLED
        );
      case SessionStatus.ACTIVE:
        return (
          newStatus === SessionStatus.COMPLETED ||
          newStatus === SessionStatus.CANCELLED
        );
      case SessionStatus.COMPLETED:
      case SessionStatus.CANCELLED:
        // Terminal states - no transitions allowed
        return false;
      default:
        return false;
    }
  }

  /**
   * Get valid status transitions from a given status.
   * Helper method for error messages.
   *
   * @param status - Current status
   * @returns Array of valid next statuses
   */
  private getValidTransitions(status: SessionStatus): SessionStatus[] {
    switch (status) {
      case SessionStatus.PENDING:
        return [SessionStatus.ACTIVE, SessionStatus.CANCELLED];
      case SessionStatus.ACTIVE:
        return [SessionStatus.COMPLETED, SessionStatus.CANCELLED];
      case SessionStatus.COMPLETED:
      case SessionStatus.CANCELLED:
        return [];
      default:
        return [];
    }
  }
}

