import { apiClient } from '../api';
import type {
  OverviewStats,
  SessionAnalytics,
  SessionDetailAnalytics,
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

export async function getAnalyticsSessions(): Promise<SessionAnalytics[]> {
  const response =
    await apiClient.get<SessionAnalytics[]>('/analytics/sessions');
  return response.data;
}

export async function getAnalyticsSession(
  id: string,
): Promise<SessionDetailAnalytics> {
  const response = await apiClient.get<SessionDetailAnalytics>(
    `/analytics/sessions/${id}`,
  );
  return response.data;
}

export async function getAnalyticsExperts(): Promise<ExpertStats[]> {
  const response = await apiClient.get<ExpertStats[]>('/analytics/experts');
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

export async function getAnalyticsComparisons(): Promise<ComparisonStats[]> {
  const response =
    await apiClient.get<ComparisonStats[]>('/analytics/comparisons');
  return response.data;
}
