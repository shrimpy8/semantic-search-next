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

// LLM Model info
export interface LlmModelInfo {
  id: string;
  name: string;
  description: string;
}

export interface LlmProviderInfo {
  available: boolean;
  models: LlmModelInfo[];
  default: string;
  note?: string;
  description?: string;
}

// Response from /settings/llm-models
export interface LlmModelsResponse {
  answer_providers: Record<string, LlmProviderInfo>;
  eval_providers: Record<string, LlmProviderInfo>;
  recommended: {
    answer_provider: string;
    answer_model: string;
    eval_provider: string;
    eval_model: string;
  };
}

// Setup validation types
export interface SetupValidationItem {
  name: string;
  status: 'ok' | 'warning' | 'error' | 'not_configured';
  message: string;
  required: boolean;
}

export interface SetupValidationResponse {
  ready: boolean;
  checks: SetupValidationItem[];
  summary: string;
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

  // Evaluation settings
  eval_judge_provider: 'openai' | 'anthropic' | 'ollama' | 'disabled';
  eval_judge_model: string;

  // Answer generation settings
  answer_provider: 'openai' | 'anthropic' | 'ollama';
  answer_model: string;
  answer_style: 'concise' | 'balanced' | 'detailed';

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

  // Evaluation settings
  eval_judge_provider?: 'openai' | 'anthropic' | 'ollama' | 'disabled';
  eval_judge_model?: string;

  // Answer generation settings
  answer_provider?: 'openai' | 'anthropic' | 'ollama';
  answer_model?: string;
  answer_style?: 'concise' | 'balanced' | 'detailed';

  // Safety confirmation
  confirm_reindex?: boolean;
}

export const settingsApi = {
  get: () => apiClient.get<Settings>('/settings'),

  update: (data: SettingsUpdate) => apiClient.patch<Settings>('/settings', data),

  reset: () => apiClient.post<Settings>('/settings/reset'),

  getEmbeddingProviders: () =>
    apiClient.get<EmbeddingProvidersResponse>('/settings/embedding-providers'),

  getLlmModels: () => apiClient.get<LlmModelsResponse>('/settings/llm-models'),

  validate: () => apiClient.get<SetupValidationResponse>('/settings/validate'),
};
