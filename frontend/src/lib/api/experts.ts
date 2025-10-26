import { apiClient } from '../api';
import type { ExpertResponse, CreateExpertDto, UpdateExpertDto } from '@/types';

export async function getExperts(): Promise<ExpertResponse[]> {
  const response = await apiClient.get<ExpertResponse[]>('/experts');
  return response.data;
}

export async function getExpert(id: string): Promise<ExpertResponse> {
  const response = await apiClient.get<ExpertResponse>(`/experts/${id}`);
  return response.data;
}

export async function createExpert(data: CreateExpertDto): Promise<ExpertResponse> {
  const response = await apiClient.post<ExpertResponse>('/experts', data);
  return response.data;
}

export async function updateExpert(
  id: string,
  data: UpdateExpertDto,
): Promise<ExpertResponse> {
  const response = await apiClient.patch<ExpertResponse>(`/experts/${id}`, data);
  return response.data;
}

export async function deleteExpert(id: string): Promise<void> {
  await apiClient.delete(`/experts/${id}`);
}

