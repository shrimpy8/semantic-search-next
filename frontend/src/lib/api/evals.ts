import { apiClient } from './client';

// ============================================================================
// Types for Ground Truth
// ============================================================================

export interface GroundTruth {
  id: string;
  collection_id: string;
  query: string;
  expected_answer: string;
  expected_sources: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroundTruthCreate {
  collection_id: string;
  query: string;
  expected_answer: string;
  expected_sources?: string[];
  notes?: string;
}

export interface GroundTruthUpdate {
  query?: string;
  expected_answer?: string;
  expected_sources?: string[];
  notes?: string;
}

export interface GroundTruthListResponse {
  data: GroundTruth[];
  has_more: boolean;
  total_count: number;
  next_cursor: string | null;
}

// ============================================================================
// Types for Evaluation Results
// ============================================================================

export interface EvaluationScores {
  context_relevance: number | null;
  context_precision: number | null;
  context_coverage: number | null;
  faithfulness: number | null;
  answer_relevance: number | null;
  completeness: number | null;
  ground_truth_similarity: number | null;
  retrieval_score: number | null;
  answer_score: number | null;
  overall_score: number | null;
}

export interface SearchConfig {
  search_alpha: number | null;
  search_preset: string | null;
  search_use_reranker: boolean | null;
  reranker_provider: string | null;
  chunk_size: number | null;
  chunk_overlap: number | null;
  embedding_model: string | null;
  answer_model: string | null;
}

export interface EvaluationResult {
  id: string;
  search_query_id: string | null;
  ground_truth_id: string | null;
  evaluation_run_id: string | null;
  query: string;
  generated_answer: string | null;
  expected_answer: string | null;
  judge_provider: string;
  judge_model: string;
  scores: EvaluationScores;
  search_config: SearchConfig | null;
  eval_latency_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export interface EvaluationResultListResponse {
  data: EvaluationResult[];
  has_more: boolean;
  total_count: number;
  next_cursor: string | null;
}

// ============================================================================
// Types for Evaluation Stats
// ============================================================================

export interface EvaluationStats {
  total_evaluations: number;
  avg_overall_score: number | null;
  avg_retrieval_score: number | null;
  avg_answer_score: number | null;
  avg_context_relevance: number | null;
  avg_context_precision: number | null;
  avg_context_coverage: number | null;
  avg_faithfulness: number | null;
  avg_answer_relevance: number | null;
  avg_completeness: number | null;
  excellent_count: number;
  good_count: number;
  moderate_count: number;
  poor_count: number;
  period_days: number;
}

// ============================================================================
// Types for Running Evaluation
// ============================================================================

export interface ChunkForEvaluation {
  content: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface EvaluateRequest {
  query: string;
  answer: string;
  chunks: ChunkForEvaluation[];
  ground_truth_id?: string;
  search_query_id?: string;
  provider?: string;
  model?: string;
  // Search configuration (optional - captured for comparison)
  search_alpha?: number;
  search_preset?: string;
  search_use_reranker?: boolean;
  reranker_provider?: string;
  chunk_size?: number;
  chunk_overlap?: number;
  embedding_model?: string;
  answer_model?: string;
}

export interface AvailableProviders {
  available: string[];
  registered: string[];
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface GroundTruthListParams {
  collection_id?: string;
  limit?: number;
  starting_after?: string;
}

export interface EvaluationResultListParams {
  ground_truth_id?: string;
  search_query_id?: string;
  limit?: number;
  starting_after?: string;
}

export interface EvaluationStatsParams {
  days?: number;
}

// ============================================================================
// Helpers
// ============================================================================

function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  }
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// ============================================================================
// API Client
// ============================================================================

export const evalsApi = {
  // ---------------------------------------------------------------------------
  // Ground Truth CRUD
  // ---------------------------------------------------------------------------

  /**
   * List ground truths with optional filtering by collection
   */
  listGroundTruths: (params: GroundTruthListParams = {}) =>
    apiClient.get<GroundTruthListResponse>(
      `/evals/ground-truths${buildQueryString(params as Record<string, unknown>)}`
    ),

  /**
   * Get a single ground truth by ID
   */
  getGroundTruth: (id: string) =>
    apiClient.get<GroundTruth>(`/evals/ground-truths/${id}`),

  /**
   * Create a new ground truth entry
   */
  createGroundTruth: (data: GroundTruthCreate) =>
    apiClient.post<GroundTruth>('/evals/ground-truths', data),

  /**
   * Update an existing ground truth entry
   */
  updateGroundTruth: (id: string, data: GroundTruthUpdate) =>
    apiClient.patch<GroundTruth>(`/evals/ground-truths/${id}`, data),

  /**
   * Delete a ground truth entry
   */
  deleteGroundTruth: (id: string) =>
    apiClient.delete<{ id: string; object: string }>(`/evals/ground-truths/${id}`),

  // ---------------------------------------------------------------------------
  // Evaluation Results
  // ---------------------------------------------------------------------------

  /**
   * List evaluation results with optional filtering
   */
  listResults: (params: EvaluationResultListParams = {}) =>
    apiClient.get<EvaluationResultListResponse>(
      `/evals/results${buildQueryString(params as Record<string, unknown>)}`
    ),

  /**
   * Get a single evaluation result by ID
   */
  getResult: (id: string) =>
    apiClient.get<EvaluationResult>(`/evals/results/${id}`),

  // ---------------------------------------------------------------------------
  // Evaluation Statistics
  // ---------------------------------------------------------------------------

  /**
   * Get aggregate evaluation statistics
   */
  getStats: (params: EvaluationStatsParams = {}) =>
    apiClient.get<EvaluationStats>(
      `/evals/stats${buildQueryString(params as Record<string, unknown>)}`
    ),

  // ---------------------------------------------------------------------------
  // Run Evaluation
  // ---------------------------------------------------------------------------

  /**
   * Evaluate a Q&A pair
   * Note: Uses postSlow for extended timeout since LLM evaluation can be slow
   */
  evaluate: (data: EvaluateRequest) =>
    apiClient.postSlow<EvaluationResult>('/evals/evaluate', data),

  /**
   * Get available judge providers
   */
  getProviders: () =>
    apiClient.get<AvailableProviders>('/evals/providers'),
};
