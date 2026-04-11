import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAnalyticsOverview,
  getAnalyticsSessions,
  getAnalyticsExperts,
  getAnalyticsExpert,
  getAnalyticsComparisons,
} from './analytics';
import { apiClient } from '../api';

vi.mock('../api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analytics API client', () => {
  describe('getAnalyticsOverview', () => {
    const mockOverview = {
      totalSessions: 10,
      completedSessions: 8,
      totalTokens: 50000,
      totalPromptTokens: 30000,
      totalCompletionTokens: 20000,
      estimatedCostUsd: 1.5,
      avgRoundsToConsensus: 3.2,
    };

    it('fetches overview without filters', async () => {
      mockGet.mockResolvedValue({ data: mockOverview });
      const result = await getAnalyticsOverview();
      expect(mockGet).toHaveBeenCalledWith('/analytics/overview', {
        params: {},
      });
      expect(result).toEqual(mockOverview);
    });

    it('passes date range filters', async () => {
      mockGet.mockResolvedValue({ data: mockOverview });
      await getAnalyticsOverview({ from: '2026-01-01', to: '2026-04-01' });
      expect(mockGet).toHaveBeenCalledWith('/analytics/overview', {
        params: { from: '2026-01-01', to: '2026-04-01' },
      });
    });

    it('omits undefined filter values', async () => {
      mockGet.mockResolvedValue({ data: mockOverview });
      await getAnalyticsOverview({ from: '2026-01-01' });
      expect(mockGet).toHaveBeenCalledWith('/analytics/overview', {
        params: { from: '2026-01-01' },
      });
    });
  });

  describe('getAnalyticsSessions', () => {
    it('fetches sessions list', async () => {
      const mockSessions = [
        {
          sessionId: '1',
          problemStatement: 'test',
          status: 'COMPLETED',
          totalTokens: 1000,
          totalRounds: 3,
          estimatedCostUsd: 0.5,
          consensusReached: true,
          durationMs: 60000,
          createdAt: '2026-04-01',
        },
      ];
      mockGet.mockResolvedValue({ data: mockSessions });
      const result = await getAnalyticsSessions();
      expect(mockGet).toHaveBeenCalledWith('/analytics/sessions', {
        params: {},
      });
      expect(result).toEqual(mockSessions);
    });
  });

  describe('getAnalyticsExperts', () => {
    it('fetches experts list', async () => {
      const mockExperts = [
        {
          expertId: '1',
          name: 'Expert A',
          specialty: 'AI',
          totalSessions: 5,
          avgTokensPerMessage: 200,
          consensusRate: 0.8,
        },
      ];
      mockGet.mockResolvedValue({ data: mockExperts });
      const result = await getAnalyticsExperts();
      expect(mockGet).toHaveBeenCalledWith('/analytics/experts', {
        params: {},
      });
      expect(result).toEqual(mockExperts);
    });
  });

  describe('getAnalyticsExpert', () => {
    it('fetches expert detail by id', async () => {
      const mockDetail = {
        expertId: '1',
        name: 'Expert A',
        specialty: 'AI',
        totalSessions: 5,
        sessions: [],
      };
      mockGet.mockResolvedValue({ data: mockDetail });
      const result = await getAnalyticsExpert('1');
      expect(mockGet).toHaveBeenCalledWith('/analytics/experts/1');
      expect(result).toEqual(mockDetail);
    });
  });

  describe('getAnalyticsComparisons', () => {
    it('fetches comparisons', async () => {
      const mockComparisons = [
        {
          expertCombination: ['1', '2'],
          sessionCount: 3,
          avgRounds: 4,
          consensusRate: 0.67,
          avgTotalTokens: 5000,
        },
      ];
      mockGet.mockResolvedValue({ data: mockComparisons });
      const result = await getAnalyticsComparisons();
      expect(mockGet).toHaveBeenCalledWith('/analytics/comparisons', {
        params: {},
      });
      expect(result).toEqual(mockComparisons);
    });
  });
});
