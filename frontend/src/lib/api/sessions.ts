import { apiClient } from '../api';
import type {
  SessionResponse,
  CreateSessionDto,
  MessageResponse,
  TokenResponse,
} from '@/types';

export async function getSessions(): Promise<SessionResponse[]> {
  const response = await apiClient.get<SessionResponse[]>('/sessions');
  return response.data;
}

export async function getSession(id: string): Promise<SessionResponse> {
  const response = await apiClient.get<SessionResponse>(`/sessions/${id}`);
  return response.data;
}

export async function createSession(data: CreateSessionDto): Promise<SessionResponse> {
  const response = await apiClient.post<SessionResponse>('/sessions', data);
  return response.data;
}

export async function getSessionMessages(id: string): Promise<MessageResponse[]> {
  const response = await apiClient.get<MessageResponse[]>(`/sessions/${id}/messages`);
  return response.data;
}

export async function startSession(id: string): Promise<SessionResponse> {
  const response = await apiClient.post<SessionResponse>(`/sessions/${id}/start`);
  return response.data;
}

export async function getSessionToken(id: string): Promise<TokenResponse> {
  const response = await apiClient.post<TokenResponse>(`/sessions/${id}/token`);
  return response.data;
}

