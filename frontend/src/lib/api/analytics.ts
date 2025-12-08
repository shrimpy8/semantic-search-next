import { apiClient } from './client';

// Search query from history
export interface SearchQueryRecord {
  id: string;
  query_text: string;
  collection_id: string | null;
  retrieval_method: string | null;
  results_count: number | null;
  latency_ms: number | null;
  user_feedback: boolean | null;
  created_at: string;
}

// Search history response
export interface SearchHistoryResponse {
  data: SearchQueryRecord[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// Search stats response
export interface SearchStatsResponse {
  total_searches: number;
  avg_latency_ms: number;
  success_rate: number;
  successful_searches: number;
  zero_results_count: number;
  searches_by_preset: Record<string, number>;
  period_days: number;
}

// Trend data point
export interface TrendDataPoint {
  period: string;
  search_count: number;
  avg_latency_ms: number;
}

// Search trends response
export interface SearchTrendsResponse {
  data: TrendDataPoint[];
  granularity: string;
  period_days: number;
}

// Top query record
export interface TopQueryRecord {
  query: string;
  count: number;
  avg_latency_ms: number;
  avg_results: number;
}

// Top queries response
export interface TopQueriesResponse {
  data: TopQueryRecord[];
  period_days: number;
}

// Query parameters
export interface SearchHistoryParams {
  limit?: number;
  offset?: number;
  collection_id?: string;
  start_date?: string;
  end_date?: string;
}

export interface StatsParams {
  collection_id?: string;
  days?: number;
}

export interface TrendsParams {
  collection_id?: string;
  days?: number;
  granularity?: 'hour' | 'day' | 'week';
}

export interface TopQueriesParams {
  limit?: number;
  collection_id?: string;
  days?: number;
}

// Build query string from params
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

export const analyticsApi = {
  /**
   * Get paginated search history
   */
  getSearchHistory: (params: SearchHistoryParams = {}) =>
    apiClient.get<SearchHistoryResponse>(`/analytics/searches${buildQueryString(params as Record<string, unknown>)}`),

  /**
   * Get aggregated search statistics
   */
  getStats: (params: StatsParams = {}) =>
    apiClient.get<SearchStatsResponse>(`/analytics/stats${buildQueryString(params as Record<string, unknown>)}`),

  /**
   * Get time-series search trends
   */
  getTrends: (params: TrendsParams = {}) =>
    apiClient.get<SearchTrendsResponse>(`/analytics/trends${buildQueryString(params as Record<string, unknown>)}`),

  /**
   * Get most frequent search queries
   */
  getTopQueries: (params: TopQueriesParams = {}) =>
    apiClient.get<TopQueriesResponse>(`/analytics/top-queries${buildQueryString(params as Record<string, unknown>)}`),
};
