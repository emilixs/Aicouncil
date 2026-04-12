import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../common/prisma.service';

/**
 * RED phase tests for AnalyticsService.
 *
 * These tests verify that:
 * 1. computeSessionMetrics() aggregates token sums, round count, message count correctly
 * 2. computeSessionMetrics() counts intervention messages separately
 * 3. computeSessionMetrics() computes duration from first to last message
 * 4. computeSessionMetrics() calculates average response time
 * 5. computeSessionMetrics() estimates cost using pricing config
 * 6. computeSessionMetrics() handles zero messages gracefully
 * 7. computeSessionMetrics() handles null analytics fields gracefully
 *
 * All tests should FAIL because analytics.service.ts does not exist yet.
 */

const mockPrismaService = {
  message: {
    findMany: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    count: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  sessionMetrics: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  sessionExpert: {
    findMany: jest.fn(),
  },
};

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalyticsService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    jest.clearAllMocks();
  });

  const sessionId = 'test-session-id';
  const now = new Date('2026-04-11T12:00:00Z');

  const mockMessages = [
    {
      id: 'msg-1',
      sessionId,
      expertId: 'expert-1',
      content: 'First response',
      role: 'ASSISTANT',
      isIntervention: false,
      timestamp: new Date('2026-04-11T12:00:00Z'),
      roundNumber: 1,
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      model: 'claude-3-sonnet-20240229',
      responseTimeMs: 1000,
      finishReason: 'stop',
    },
    {
      id: 'msg-2',
      sessionId,
      expertId: 'expert-2',
      content: 'Second response',
      role: 'ASSISTANT',
      isIntervention: false,
      timestamp: new Date('2026-04-11T12:01:00Z'),
      roundNumber: 1,
      promptTokens: 120,
      completionTokens: 60,
      totalTokens: 180,
      model: 'claude-3-sonnet-20240229',
      responseTimeMs: 1500,
      finishReason: 'stop',
    },
    {
      id: 'msg-3',
      sessionId,
      expertId: null,
      content: 'User intervention',
      role: 'USER',
      isIntervention: true,
      timestamp: new Date('2026-04-11T12:01:30Z'),
      roundNumber: 1,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      model: null,
      responseTimeMs: null,
      finishReason: null,
    },
    {
      id: 'msg-4',
      sessionId,
      expertId: 'expert-1',
      content: 'Third response',
      role: 'ASSISTANT',
      isIntervention: false,
      timestamp: new Date('2026-04-11T12:02:00Z'),
      roundNumber: 2,
      promptTokens: 200,
      completionTokens: 80,
      totalTokens: 280,
      model: 'claude-3-sonnet-20240229',
      responseTimeMs: 2000,
      finishReason: 'stop',
    },
  ];

  const mockSession = {
    id: sessionId,
    problemStatement: 'Test problem',
    status: 'COMPLETED',
    maxMessages: 20,
    consensusReached: true,
    createdAt: new Date('2026-04-11T11:59:00Z'),
    updatedAt: new Date('2026-04-11T12:03:00Z'),
  };

  describe('computeSessionMetrics()', () => {
    it('should correctly aggregate token sums', async () => {
      mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.sessionMetrics.upsert.mockImplementation(async (args: any) => args.create);

      const result = await service.computeSessionMetrics(sessionId);

      // Sum of non-null tokens: 100+120+200=420 prompt, 50+60+80=190 completion, 150+180+280=610 total
      expect(result.totalPromptTokens).toBe(420);
      expect(result.totalCompletionTokens).toBe(190);
      expect(result.totalTokens).toBe(610);
    });

    it('should correctly count rounds', async () => {
      mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.sessionMetrics.upsert.mockImplementation(async (args: any) => args.create);

      const result = await service.computeSessionMetrics(sessionId);

      // Max roundNumber is 2
      expect(result.totalRounds).toBe(2);
    });

    it('should correctly count total messages', async () => {
      mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.sessionMetrics.upsert.mockImplementation(async (args: any) => args.create);

      const result = await service.computeSessionMetrics(sessionId);

      expect(result.totalMessages).toBe(4);
    });

    it('should correctly count intervention messages', async () => {
      mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.sessionMetrics.upsert.mockImplementation(async (args: any) => args.create);

      const result = await service.computeSessionMetrics(sessionId);

      expect(result.totalInterventions).toBe(1);
    });

    it('should compute duration from first to last message timestamp', async () => {
      mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.sessionMetrics.upsert.mockImplementation(async (args: any) => args.create);

      const result = await service.computeSessionMetrics(sessionId);

      // From 12:00:00 to 12:02:00 = 120000ms
      expect(result.durationMs).toBe(120000);
    });

    it('should compute average response time from non-null values', async () => {
      mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.sessionMetrics.upsert.mockImplementation(async (args: any) => args.create);

      const result = await service.computeSessionMetrics(sessionId);

      // Avg of 1000, 1500, 2000 = 1500
      expect(result.avgResponseTimeMs).toBe(1500);
    });

    it('should estimate cost using pricing config', async () => {
      mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.sessionMetrics.upsert.mockImplementation(async (args: any) => args.create);

      const result = await service.computeSessionMetrics(sessionId);

      // Cost should be computed and be a positive number
      expect(result.estimatedCostUsd).toBeDefined();
      expect(result.estimatedCostUsd).toBeGreaterThan(0);
    });

    it('should handle zero messages gracefully', async () => {
      mockPrismaService.message.findMany.mockResolvedValue([]);
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.sessionMetrics.upsert.mockImplementation(async (args: any) => args.create);

      const result = await service.computeSessionMetrics(sessionId);

      expect(result.totalTokens).toBe(0);
      expect(result.totalPromptTokens).toBe(0);
      expect(result.totalCompletionTokens).toBe(0);
      expect(result.totalRounds).toBe(0);
      expect(result.totalMessages).toBe(0);
      expect(result.totalInterventions).toBe(0);
      expect(result.durationMs).toBe(0);
      expect(result.avgResponseTimeMs).toBe(0);
    });

    it('should handle messages with all null analytics fields', async () => {
      const nullMessages = [
        {
          id: 'msg-1',
          sessionId,
          expertId: 'expert-1',
          content: 'Legacy message',
          role: 'ASSISTANT',
          isIntervention: false,
          timestamp: new Date('2026-04-11T12:00:00Z'),
          roundNumber: null,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          model: null,
          responseTimeMs: null,
          finishReason: null,
        },
      ];

      mockPrismaService.message.findMany.mockResolvedValue(nullMessages);
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.sessionMetrics.upsert.mockImplementation(async (args: any) => args.create);

      const result = await service.computeSessionMetrics(sessionId);

      expect(result.totalTokens).toBe(0);
      expect(result.totalPromptTokens).toBe(0);
      expect(result.totalCompletionTokens).toBe(0);
      expect(result.totalRounds).toBe(0);
      expect(result.totalMessages).toBe(1);
      expect(result.avgResponseTimeMs).toBe(0);
    });
  });

  describe('getOverview()', () => {
    it('should return aggregate overview data', async () => {
      mockPrismaService.session.findMany.mockResolvedValue([mockSession]);
      mockPrismaService.sessionMetrics.aggregate.mockResolvedValue({
        _sum: { totalTokens: 610, totalPromptTokens: 420, totalCompletionTokens: 190 },
        _avg: { totalRounds: 2 },
        _count: 1,
      });

      const result = await service.getOverview();

      expect(result).toHaveProperty('totalSessions');
      expect(result).toHaveProperty('completedSessions');
      expect(result).toHaveProperty('totalTokens');
      expect(result).toHaveProperty('totalPromptTokens');
      expect(result).toHaveProperty('totalCompletionTokens');
      expect(result).toHaveProperty('estimatedCostUsd');
      expect(result).toHaveProperty('avgRoundsToConsensus');
    });
  });

  describe('getSessionAnalytics()', () => {
    it('should return per-session breakdown with per-expert data', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
      mockPrismaService.sessionMetrics.findUnique.mockResolvedValue({
        sessionId,
        totalTokens: 610,
        totalPromptTokens: 420,
        totalCompletionTokens: 190,
        totalRounds: 2,
        totalMessages: 4,
        totalInterventions: 1,
        durationMs: 120000,
        avgResponseTimeMs: 1500,
        estimatedCostUsd: 0.01,
      });

      const result = await service.getSessionAnalytics(sessionId);

      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('perExpert');
      expect(Array.isArray(result.perExpert)).toBe(true);
      if (result.perExpert.length > 0) {
        expect(result.perExpert[0]).toHaveProperty('expertId');
        expect(result.perExpert[0]).toHaveProperty('totalTokens');
        expect(result.perExpert[0]).toHaveProperty('messageCount');
      }
    });
  });

  describe('getSessionsList()', () => {
    it('should return paginated list of sessions with metrics', async () => {
      const result = await service.getSessionsList();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getExpertsList()', () => {
    it('should return list of experts with aggregate metrics', async () => {
      const result = await service.getExpertsList();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getExpertAnalytics()', () => {
    it('should return analytics for a single expert', async () => {
      const result = await service.getExpertAnalytics('expert-1');

      expect(result).toHaveProperty('expertId');
    });
  });

  describe('getComparisons()', () => {
    it('should return expert combination effectiveness data', async () => {
      const result = await service.getComparisons();

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
