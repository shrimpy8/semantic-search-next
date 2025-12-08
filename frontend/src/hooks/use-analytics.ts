'use client';

import { useQuery } from '@tanstack/react-query';
import {
  analyticsApi,
  type SearchHistoryParams,
  type StatsParams,
  type TrendsParams,
  type TopQueriesParams,
} from '@/lib/api/analytics';

// Query keys for cache management
export const analyticsKeys = {
  all: ['analytics'] as const,
  history: (params: SearchHistoryParams) => [...analyticsKeys.all, 'history', params] as const,
  stats: (params: StatsParams) => [...analyticsKeys.all, 'stats', params] as const,
  trends: (params: TrendsParams) => [...analyticsKeys.all, 'trends', params] as const,
  topQueries: (params: TopQueriesParams) => [...analyticsKeys.all, 'top-queries', params] as const,
};

/**
 * Hook to fetch paginated search history
 */
export function useSearchHistory(params: SearchHistoryParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.history(params),
    queryFn: () => analyticsApi.getSearchHistory(params),
    staleTime: 30 * 1000, // Cache for 30 seconds (analytics data refreshes frequently)
  });
}

/**
 * Hook to fetch aggregated search statistics
 */
export function useSearchStats(params: StatsParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.stats(params),
    queryFn: () => analyticsApi.getStats(params),
    staleTime: 60 * 1000, // Cache for 1 minute
  });
}

/**
 * Hook to fetch time-series search trends
 */
export function useSearchTrends(params: TrendsParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.trends(params),
    queryFn: () => analyticsApi.getTrends(params),
    staleTime: 60 * 1000, // Cache for 1 minute
  });
}

/**
 * Hook to fetch top search queries
 */
export function useTopQueries(params: TopQueriesParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.topQueries(params),
    queryFn: () => analyticsApi.getTopQueries(params),
    staleTime: 60 * 1000, // Cache for 1 minute
  });
}
