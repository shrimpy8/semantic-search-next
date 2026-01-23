import { apiClient } from './client';

export type RetrievalPreset = 'high_precision' | 'balanced' | 'high_recall' | 'custom';

export interface SearchRequest {
  query: string;
  collection_id?: string;
  document_ids?: string[];
  preset?: RetrievalPreset;
  top_k?: number;
  alpha?: number;
  use_reranker?: boolean;
  generate_answer?: boolean;
}

export interface SearchScores {
  semantic_score?: number | null;
  bm25_score?: number | null;
  rerank_score?: number | null;
  final_score: number;
  relevance_percent: number;
}

export interface SearchResult {
  id: string;
  document_id: string;
  document_name: string;
  collection_id: string;
  collection_name: string;
  content: string;
  page?: number;
  section?: string | null;
  verified: boolean;
  scores: SearchScores;
  metadata?: Record<string, unknown>;
  // Context expansion fields (P2)
  context_before?: string | null;
  context_after?: string | null;
  chunk_index?: number | null;
  total_chunks?: number | null;
}

export interface Citation {
  claim: string;
  source_index: number;
  source_name: string;
  quote: string;
  verified: boolean;
}

export interface AnswerVerification {
  confidence: 'high' | 'medium' | 'low' | 'unverified';
  citations: Citation[];
  warning?: string | null;
  verified_claims: number;
  total_claims: number;
  coverage_percent: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  low_confidence_results: SearchResult[];
  low_confidence_count: number;
  min_score_threshold: number;
  answer?: string | null;
  answer_verification?: AnswerVerification | null;
  sources?: string[];
  latency_ms: number;
  retrieval_method: string;
  // Search configuration (for evaluation capture)
  search_alpha?: number | null;
  search_use_reranker?: boolean | null;
  reranker_provider?: string | null;
  chunk_size?: number | null;
  chunk_overlap?: number | null;
  embedding_model?: string | null;
  answer_model?: string | null;
  // Injection detection warnings (M3A)
  injection_warning?: boolean;
  injection_details?: {
    query?: { patterns: string[]; score: number };
    chunks?: { flagged_count: number; total_count: number; flagged: Array<{ index: number; patterns: string[]; score: number }> };
  } | null;
}

export const searchApi = {
  // Use postSlow for search - RAG generation can take 15-30 seconds
  search: (data: SearchRequest) => apiClient.postSlow<SearchResponse>('/search', data),
};
