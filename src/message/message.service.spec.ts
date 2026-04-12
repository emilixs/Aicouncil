import { Test, TestingModule } from '@nestjs/testing';
import { MessageService } from './message.service';
import { PrismaService } from '../common/prisma.service';
import { MessageRole, SessionStatus } from '@prisma/client';

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
});
