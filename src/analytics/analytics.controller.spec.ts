import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

/**
 * RED phase tests for AnalyticsController.
 *
 * These tests verify that:
 * 1. GET /analytics/overview returns correct structure
 * 2. GET /analytics/sessions returns paginated list
 * 3. GET /analytics/sessions/:id returns per-session breakdown
 * 4. GET /analytics/experts returns expert list
 * 5. GET /analytics/experts/:id returns single expert analytics
 * 6. GET /analytics/comparisons returns combination data
 * 7. Date range filtering works
 * 8. Empty database returns zero-value responses (not errors)
 *
 * All tests should FAIL because analytics.controller.ts does not exist yet.
 */

const mockAnalyticsService = {
  getOverview: jest.fn(),
  getSessionsList: jest.fn(),
  getSessionAnalytics: jest.fn(),
  getExpertsList: jest.fn(),
  getExpertAnalytics: jest.fn(),
  getComparisons: jest.fn(),
};

describe('AnalyticsController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: mockAnalyticsService }],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /analytics/overview', () => {
    it('should return 200 with overview data', async () => {
      const overviewData = {
        totalSessions: 10,
        completedSessions: 8,
        totalTokens: 50000,
        totalPromptTokens: 30000,
        totalCompletionTokens: 20000,
        estimatedCostUsd: 1.25,
        avgRoundsToConsensus: 3.5,
      };

      mockAnalyticsService.getOverview.mockResolvedValue(overviewData);

      const response = await request(app.getHttpServer()).get('/analytics/overview').expect(200);

      expect(response.body).toEqual(overviewData);
      expect(mockAnalyticsService.getOverview).toHaveBeenCalled();
    });

    it('should pass date range filter params to service', async () => {
      mockAnalyticsService.getOverview.mockResolvedValue({
        totalSessions: 0,
        completedSessions: 0,
        totalTokens: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        estimatedCostUsd: 0,
        avgRoundsToConsensus: 0,
      });

      await request(app.getHttpServer())
        .get('/analytics/overview?from=2026-04-01&to=2026-04-11')
        .expect(200);

      expect(mockAnalyticsService.getOverview).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '2026-04-01',
          to: '2026-04-11',
        }),
      );
    });

    it('should return zero-value response for empty database (not error)', async () => {
      mockAnalyticsService.getOverview.mockResolvedValue({
        totalSessions: 0,
        completedSessions: 0,
        totalTokens: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        estimatedCostUsd: 0,
        avgRoundsToConsensus: 0,
      });

      const response = await request(app.getHttpServer()).get('/analytics/overview').expect(200);

      expect(response.body.totalSessions).toBe(0);
      expect(response.body.totalTokens).toBe(0);
    });
  });

  describe('GET /analytics/sessions', () => {
    it('should return 200 with sessions list', async () => {
      const sessionsData = [
        {
          sessionId: 'session-1',
          problemStatement: 'Test problem',
          status: 'COMPLETED',
          totalTokens: 500,
          totalRounds: 3,
          estimatedCostUsd: 0.05,
          consensusReached: true,
          durationMs: 60000,
          createdAt: '2026-04-11T12:00:00Z',
        },
      ];

      mockAnalyticsService.getSessionsList.mockResolvedValue(sessionsData);

      const response = await request(app.getHttpServer()).get('/analytics/sessions').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].sessionId).toBe('session-1');
    });

    it('should return empty array for no sessions', async () => {
      mockAnalyticsService.getSessionsList.mockResolvedValue([]);

      const response = await request(app.getHttpServer()).get('/analytics/sessions').expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('GET /analytics/sessions/:id', () => {
    it('should return 200 with session analytics', async () => {
      const sessionAnalytics = {
        metrics: {
          totalTokens: 610,
          totalPromptTokens: 420,
          totalCompletionTokens: 190,
          totalRounds: 2,
          totalMessages: 4,
          totalInterventions: 1,
          durationMs: 120000,
          avgResponseTimeMs: 1500,
          estimatedCostUsd: 0.01,
        },
        perExpert: [
          {
            expertId: 'expert-1',
            name: 'Expert One',
            totalTokens: 430,
            messageCount: 2,
            avgResponseTimeMs: 1500,
          },
          {
            expertId: 'expert-2',
            name: 'Expert Two',
            totalTokens: 180,
            messageCount: 1,
            avgResponseTimeMs: 1500,
          },
        ],
      };

      mockAnalyticsService.getSessionAnalytics.mockResolvedValue(sessionAnalytics);

      const response = await request(app.getHttpServer())
        .get('/analytics/sessions/test-session-id')
        .expect(200);

      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('perExpert');
      expect(response.body.perExpert).toHaveLength(2);
    });
  });

  describe('GET /analytics/experts', () => {
    it('should return 200 with experts list', async () => {
      const expertsData = [
        {
          expertId: 'expert-1',
          name: 'Expert One',
          specialty: 'Testing',
          totalSessions: 5,
          avgTokensPerMessage: 200,
          consensusRate: 0.8,
        },
      ];

      mockAnalyticsService.getExpertsList.mockResolvedValue(expertsData);

      const response = await request(app.getHttpServer()).get('/analytics/experts').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('expertId');
      expect(response.body[0]).toHaveProperty('avgTokensPerMessage');
      expect(response.body[0]).toHaveProperty('consensusRate');
    });
  });

  describe('GET /analytics/experts/:id', () => {
    it('should return 200 with expert analytics', async () => {
      const expertAnalytics = {
        expertId: 'expert-1',
        name: 'Expert One',
        specialty: 'Testing',
        totalSessions: 5,
        avgTokensPerMessage: 200,
        consensusRate: 0.8,
        sessions: [],
      };

      mockAnalyticsService.getExpertAnalytics.mockResolvedValue(expertAnalytics);

      const response = await request(app.getHttpServer())
        .get('/analytics/experts/expert-1')
        .expect(200);

      expect(response.body.expertId).toBe('expert-1');
      expect(response.body).toHaveProperty('sessions');
    });
  });

  describe('GET /analytics/comparisons', () => {
    it('should return 200 with comparison data', async () => {
      const comparisons = [
        {
          expertCombination: ['expert-1', 'expert-2'],
          sessionCount: 3,
          avgRounds: 2.5,
          consensusRate: 0.67,
          avgTotalTokens: 800,
        },
      ];

      mockAnalyticsService.getComparisons.mockResolvedValue(comparisons);

      const response = await request(app.getHttpServer()).get('/analytics/comparisons').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('expertCombination');
      expect(response.body[0]).toHaveProperty('consensusRate');
      expect(response.body[0]).toHaveProperty('avgRounds');
    });

    it('should return empty array when no sessions exist', async () => {
      mockAnalyticsService.getComparisons.mockResolvedValue([]);

      const response = await request(app.getHttpServer()).get('/analytics/comparisons').expect(200);

      expect(response.body).toEqual([]);
    });
  });
});
