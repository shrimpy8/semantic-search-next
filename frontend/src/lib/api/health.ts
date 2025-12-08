import { apiClient } from './client';

export interface HealthResponse {
  status: string;
  timestamp: string;
  version?: string;
}

export const healthApi = {
  check: () => apiClient.get<HealthResponse>('/health'),
};
