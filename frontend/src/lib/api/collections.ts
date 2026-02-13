import { apiClient } from './client';

export interface Collection {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  is_trusted: boolean;
  document_count: number;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCollectionRequest {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  is_trusted?: boolean;
}

export interface UpdateCollectionRequest {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  is_trusted?: boolean;
}

export interface CollectionListResponse {
  data: Collection[];
  total: number;
}

export const collectionsApi = {
  list: () => apiClient.get<CollectionListResponse>('/collections'),

  get: (id: string) => apiClient.get<Collection>(`/collections/${id}`),

  create: (data: CreateCollectionRequest) => apiClient.post<Collection>('/collections', data),

  update: (id: string, data: UpdateCollectionRequest) =>
    apiClient.patch<Collection>(`/collections/${id}`, data),

  delete: (id: string, force: boolean = true) =>
    apiClient.delete<void>(`/collections/${id}?force=${force}`),
};
