import { Test, TestingModule } from '@nestjs/testing';
import { MessageService } from './message.service';
import { PrismaService } from '../common/prisma.service';
import { MessageRole, SessionStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

/**
 * RED phase tests for Message service analytics fields.
 *
 * These tests verify that:
 * 1. CreateMessageDto accepts analytics fields (roundNumber, promptTokens, etc.)
 * 2. MessageService.create() persists analytics fields to the database
 * 3. MessageResponseDto returns analytics fields
 * 4. Null analytics fields are handled gracefully
 */

const mockPrismaService = {
  session: {
    findUnique: jest.fn(),
  },
  sessionExpert: {
    findUnique: jest.fn(),
  },
  message: {
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('MessageService - Analytics Fields', () => {
  let service: MessageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MessageService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<MessageService>(MessageService);
    jest.clearAllMocks();
  });

  const sessionId = 'test-session-id';
  const expertId = 'test-expert-id';

  const mockSession = {
    id: sessionId,
    status: SessionStatus.ACTIVE,
    maxMessages: 20,
    problemStatement: 'Test problem',
    consensusReached: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMessageWithAnalytics = {
    id: 'msg-1',
    sessionId,
    expertId,
    content: 'Test response',
    role: MessageRole.ASSISTANT,
    isIntervention: false,
    timestamp: new Date(),
    roundNumber: 2,
    promptTokens: 150,
    completionTokens: 50,
    totalTokens: 200,
    model: 'claude-3-sonnet-20240229',
    responseTimeMs: 1200,
    finishReason: 'stop',
    expert: { id: expertId, name: 'Test Expert', specialty: 'Testing' },
  };

  describe('create() with analytics fields', () => {
    it('should persist analytics fields when provided', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.sessionExpert.findUnique.mockResolvedValue({
        id: '1',
        sessionId,
        expertId,
      });
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          message: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockMessageWithAnalytics),
          },
        };
        return fn(tx);
      });

      const result = await service.create({
        sessionId,
        content: 'Test response',
        expertId,
        role: MessageRole.ASSISTANT,
        roundNumber: 2,
        promptTokens: 150,
        completionTokens: 50,
        totalTokens: 200,
        model: 'claude-3-sonnet-20240229',
        responseTimeMs: 1200,
        finishReason: 'stop',
      });

      expect(result.roundNumber).toBe(2);
      expect(result.promptTokens).toBe(150);
      expect(result.completionTokens).toBe(50);
      expect(result.totalTokens).toBe(200);
      expect(result.model).toBe('claude-3-sonnet-20240229');
      expect(result.responseTimeMs).toBe(1200);
      expect(result.finishReason).toBe('stop');
    });

    it('should handle null analytics fields gracefully', async () => {
      const mockMessageNullAnalytics = {
        ...mockMessageWithAnalytics,
        roundNumber: null,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        model: null,
        responseTimeMs: null,
        finishReason: null,
      };

      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.sessionExpert.findUnique.mockResolvedValue({
        id: '1',
        sessionId,
        expertId,
      });
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          message: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockMessageNullAnalytics),
          },
        };
        return fn(tx);
      });

      const result = await service.create({
        sessionId,
        content: 'Test response',
        expertId,
        role: MessageRole.ASSISTANT,
      });

      expect(result.roundNumber).toBeNull();
      expect(result.promptTokens).toBeNull();
      expect(result.completionTokens).toBeNull();
      expect(result.totalTokens).toBeNull();
      expect(result.model).toBeNull();
      expect(result.responseTimeMs).toBeNull();
      expect(result.finishReason).toBeNull();
    });
  });

  describe('findBySession() returns analytics fields', () => {
    it('should include analytics fields in returned messages', async () => {
      mockPrismaService.message.findMany.mockResolvedValue([mockMessageWithAnalytics]);

      const result = await service.findBySession(sessionId);

      expect(result).toHaveLength(1);
      expect(result[0].roundNumber).toBe(2);
      expect(result[0].promptTokens).toBe(150);
      expect(result[0].completionTokens).toBe(50);
      expect(result[0].totalTokens).toBe(200);
      expect(result[0].model).toBe('claude-3-sonnet-20240229');
      expect(result[0].responseTimeMs).toBe(1200);
      expect(result[0].finishReason).toBe('stop');
    });
  });

  describe('create() - session validation', () => {
    it('throws NotFoundException when session does not exist', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          sessionId,
          content: 'Test',
          role: MessageRole.ASSISTANT,
        }),
      ).rejects.toThrow('not found');
    });

    it('throws BadRequestException when session is not ACTIVE', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.COMPLETED,
      });

      await expect(
        service.create({
          sessionId,
          content: 'Test',
          role: MessageRole.ASSISTANT,
        }),
      ).rejects.toThrow('must be ACTIVE');
    });

    it('throws BadRequestException when session is PENDING', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.PENDING,
      });

      await expect(
        service.create({
          sessionId,
          content: 'Test',
          role: MessageRole.ASSISTANT,
        }),
      ).rejects.toThrow('must be ACTIVE');
    });
  });

  describe('create() - expert validation', () => {
    it('throws BadRequestException when expert is not part of session', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.sessionExpert.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          sessionId,
          content: 'Test',
          expertId: 'unknown-expert',
          role: MessageRole.ASSISTANT,
        }),
      ).rejects.toThrow('not part of session');
    });
  });

  describe('create() - message limit enforcement', () => {
    it('throws BadRequestException when session reaches max messages', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue({
        ...mockSession,
        maxMessages: 5,
      });
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          message: {
            count: jest.fn().mockResolvedValue(5),
            create: jest.fn(),
          },
        };
        return fn(tx);
      });

      await expect(
        service.create({
          sessionId,
          content: 'Test',
          role: MessageRole.USER,
        }),
      ).rejects.toThrow('maximum message limit');
    });
  });

  describe('create() - error handling', () => {
    it('wraps PrismaClientKnownRequestError in InternalServerErrorException', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      const prismaError = new Error('P2002') as any;
      prismaError.constructor = { name: 'PrismaClientKnownRequestError' };
      Object.setPrototypeOf(prismaError, PrismaClientKnownRequestError.prototype);
      (prismaError as any).code = 'P2002';
      (prismaError as any).clientVersion = '5.0.0';
      (prismaError as any).meta = {};
      mockPrismaService.$transaction.mockRejectedValue(prismaError);

      await expect(
        service.create({
          sessionId,
          content: 'Test',
          role: MessageRole.USER,
        }),
      ).rejects.toThrow('Failed to create message');
    });

    it('wraps unexpected errors in InternalServerErrorException', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.$transaction.mockRejectedValue(new Error('DB connection lost'));

      await expect(
        service.create({
          sessionId,
          content: 'Test',
          role: MessageRole.USER,
        }),
      ).rejects.toThrow('unexpected error');
    });
  });

  describe('countBySession()', () => {
    it('returns message count for a session', async () => {
      mockPrismaService.message.count.mockResolvedValue(7);

      const result = await service.countBySession(sessionId);

      expect(result).toBe(7);
      expect(mockPrismaService.message.count).toHaveBeenCalledWith({
        where: { sessionId },
      });
    });

    it('throws InternalServerErrorException on database error', async () => {
      mockPrismaService.message.count.mockRejectedValue(new Error('DB error'));

      await expect(service.countBySession(sessionId)).rejects.toThrow(
        'Failed to count messages',
      );
    });
  });

  describe('findLatestBySession()', () => {
    it('returns messages in chronological order', async () => {
      const msg1 = { ...mockMessageWithAnalytics, id: 'msg-1', content: 'First' };
      const msg2 = { ...mockMessageWithAnalytics, id: 'msg-2', content: 'Second' };
      mockPrismaService.message.findMany.mockResolvedValue([msg2, msg1]);

      const result = await service.findLatestBySession(sessionId, 10);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('First');
      expect(result[1].content).toBe('Second');
    });

    it('uses default limit of 10', async () => {
      mockPrismaService.message.findMany.mockResolvedValue([]);

      await service.findLatestBySession(sessionId);

      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });

    it('throws InternalServerErrorException on database error', async () => {
      mockPrismaService.message.findMany.mockRejectedValue(new Error('DB error'));

      await expect(service.findLatestBySession(sessionId)).rejects.toThrow(
        'Failed to retrieve latest messages',
      );
    });
  });

  describe('deleteBySession()', () => {
    it('deletes all messages for a session', async () => {
      mockPrismaService.message.deleteMany = jest.fn().mockResolvedValue({ count: 5 });

      await service.deleteBySession(sessionId);

      expect(mockPrismaService.message.deleteMany).toHaveBeenCalledWith({
        where: { sessionId },
      });
    });

    it('throws InternalServerErrorException on database error', async () => {
      mockPrismaService.message.deleteMany = jest.fn().mockRejectedValue(new Error('DB error'));

      await expect(service.deleteBySession(sessionId)).rejects.toThrow(
        'Failed to delete messages',
      );
    });
  });

  describe('findBySession() - error handling', () => {
    it('throws InternalServerErrorException on database error', async () => {
      mockPrismaService.message.findMany.mockRejectedValue(new Error('DB error'));

      await expect(service.findBySession(sessionId)).rejects.toThrow(
        'Failed to retrieve messages',
      );
    });
  });
});
