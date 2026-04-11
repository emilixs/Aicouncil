import { apiClient } from '../api';
import type {
  OverviewStats,
  SessionAnalytics,
  ExpertStats,
  ExpertDetailAnalytics,
  ComparisonStats,
  DateRangeFilter,
} from '@/types/analytics';

export async function getAnalyticsOverview(
  filter?: DateRangeFilter,
): Promise<OverviewStats> {
  const params: Record<string, string> = {};
  if (filter?.from) params.from = filter.from;
  if (filter?.to) params.to = filter.to;
  const response = await apiClient.get<OverviewStats>('/analytics/overview', {
    params,
  });
  return response.data;
}

export async function getAnalyticsSessions(
  filter?: DateRangeFilter,
): Promise<SessionAnalytics[]> {
  const params: Record<string, string> = {};
  if (filter?.from) params.from = filter.from;
  if (filter?.to) params.to = filter.to;
  const response = await apiClient.get<SessionAnalytics[]>(
    '/analytics/sessions',
    { params },
  );
  return response.data;
}

export async function getAnalyticsExperts(
  filter?: DateRangeFilter,
): Promise<ExpertStats[]> {
  const params: Record<string, string> = {};
  if (filter?.from) params.from = filter.from;
  if (filter?.to) params.to = filter.to;
  const response = await apiClient.get<ExpertStats[]>('/analytics/experts', {
    params,
  });
  return response.data;
}

export async function getAnalyticsExpert(
  id: string,
): Promise<ExpertDetailAnalytics> {
  const response = await apiClient.get<ExpertDetailAnalytics>(
    `/analytics/experts/${id}`,
  );
  return response.data;
}

export async function getAnalyticsComparisons(
  filter?: DateRangeFilter,
): Promise<ComparisonStats[]> {
  const params: Record<string, string> = {};
  if (filter?.from) params.from = filter.from;
  if (filter?.to) params.to = filter.to;
  const response = await apiClient.get<ComparisonStats[]>(
    '/analytics/comparisons',
    { params },
  );
  return response.data;
}
