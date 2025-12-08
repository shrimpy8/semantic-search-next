import { apiClient } from './client';

// Embedding model info
export interface EmbeddingModelInfo {
  dims: number;
  description: string;
}

// Provider info from backend
export interface EmbeddingProviderInfo {
  available: boolean;
  models: Record<string, EmbeddingModelInfo>;
  requires_api_key: boolean;
}

// Response from /settings/embedding-providers
export interface EmbeddingProvidersResponse {
  providers: Record<string, EmbeddingProviderInfo>;
  recommended_local: string;
  recommended_cloud: string;
}

export interface Settings {
  id: string;

  // Search defaults
  default_alpha: number;
  default_use_reranker: boolean;
  default_preset: 'high_precision' | 'balanced' | 'high_recall';
  default_top_k: number;

  // Admin/Advanced settings
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  reranker_provider: 'auto' | 'jina' | 'cohere';

  // Display settings
  show_scores: boolean;
  results_per_page: number;

  // Quality threshold
  min_score_threshold: number;

  // AI Answer settings
  default_generate_answer: boolean;
  context_window_size: number;

  // Timestamps
  updated_at: string;
}

export interface SettingsUpdate {
  // Search defaults
  default_alpha?: number;
  default_use_reranker?: boolean;
  default_preset?: 'high_precision' | 'balanced' | 'high_recall';
  default_top_k?: number;

  // Admin/Advanced settings
  embedding_model?: string;
  chunk_size?: number;
  chunk_overlap?: number;
  reranker_provider?: 'auto' | 'jina' | 'cohere';

  // Display settings
  show_scores?: boolean;
  results_per_page?: number;

  // Quality threshold
  min_score_threshold?: number;

  // AI Answer settings
  default_generate_answer?: boolean;
  context_window_size?: number;
}

export const settingsApi = {
  get: () => apiClient.get<Settings>('/settings'),

  update: (data: SettingsUpdate) => apiClient.patch<Settings>('/settings', data),

  reset: () => apiClient.post<Settings>('/settings/reset'),

  getEmbeddingProviders: () =>
    apiClient.get<EmbeddingProvidersResponse>('/settings/embedding-providers'),
};
