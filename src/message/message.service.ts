import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { SessionStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CreateMessageDto, MessageResponseDto } from './dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createMessageDto: CreateMessageDto): Promise<MessageResponseDto> {
    try {
      // Validate that session exists
      const session = await this.prisma.session.findUnique({
        where: { id: createMessageDto.sessionId },
      });

      if (!session) {
        throw new NotFoundException(`Session with ID ${createMessageDto.sessionId} not found`);
      }

      // Validate that session status is ACTIVE
      if (session.status !== SessionStatus.ACTIVE) {
        throw new BadRequestException(
          `Cannot add messages to session with status ${session.status}. Session must be ACTIVE.`,
        );
      }

      // If expertId is provided, validate that expert exists and is part of the session
      if (createMessageDto.expertId) {
        const sessionExpert = await this.prisma.sessionExpert.findUnique({
          where: {
            sessionId_expertId: {
              sessionId: createMessageDto.sessionId,
              expertId: createMessageDto.expertId,
            },
          },
        });

        if (!sessionExpert) {
          throw new BadRequestException(
            `Expert ${createMessageDto.expertId} is not part of session ${createMessageDto.sessionId}`,
          );
        }
      }

      // Use transaction with Serializable isolation to prevent race conditions
      const message = await this.prisma.$transaction(
        async (tx) => {
          // Re-check message count within transaction to prevent race conditions
          const messageCount = await tx.message.count({
            where: { sessionId: createMessageDto.sessionId },
          });

          if (messageCount >= session.maxMessages) {
            throw new BadRequestException(
              `Session has reached maximum message limit of ${session.maxMessages}`,
            );
          }

          // Create message within transaction
          return await tx.message.create({
            data: createMessageDto,
            include: { expert: true },
          });
        },
        {
          isolationLevel: 'Serializable',
        },
      );

      return MessageResponseDto.fromPrisma(message);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof PrismaClientKnownRequestError) {
        this.logger.error(`Prisma error creating message: ${error.message}`, error.stack);
        throw new InternalServerErrorException('Failed to create message');
      }

      this.logger.error(`Unexpected error creating message: ${error.message}`, error.stack);
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async findBySession(sessionId: string): Promise<MessageResponseDto[]> {
    try {
      const messages = await this.prisma.message.findMany({
        where: { sessionId },
        include: { expert: true },
        orderBy: { timestamp: 'asc' },
      });

      return messages.map((message) => MessageResponseDto.fromPrisma(message));
    } catch (error) {
      this.logger.error(`Error finding messages for session ${sessionId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to retrieve messages');
    }
  }

  async countBySession(sessionId: string): Promise<number> {
    try {
      return await this.prisma.message.count({
        where: { sessionId },
      });
    } catch (error) {
      this.logger.error(`Error counting messages for session ${sessionId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to count messages');
    }
  }

  async findLatestBySession(sessionId: string, limit: number = 10): Promise<MessageResponseDto[]> {
    try {
      const messages = await this.prisma.message.findMany({
        where: { sessionId },
        include: { expert: true },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      // Reverse to get chronological order (oldest to newest)
      messages.reverse();

      return messages.map((message) => MessageResponseDto.fromPrisma(message));
    } catch (error) {
      this.logger.error(`Error finding latest messages for session ${sessionId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to retrieve latest messages');
    }
  }

  async deleteBySession(sessionId: string): Promise<void> {
    try {
      await this.prisma.message.deleteMany({
        where: { sessionId },
      });
    } catch (error) {
      this.logger.error(`Error deleting messages for session ${sessionId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to delete messages');
    }
  }
}

