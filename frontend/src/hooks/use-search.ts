'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { searchApi, type SearchRequest } from '@/lib/api';

// Query keys
export const searchKeys = {
  all: ['search'] as const,
  results: (query: string) => [...searchKeys.all, 'results', query] as const,
};

// Hooks

export function useSearch() {
  return useMutation({
    mutationFn: (request: SearchRequest) => searchApi.search(request),
  });
}

// Alternative: useQuery-based search for caching results
export function useSearchQuery(request: SearchRequest | null) {
  return useQuery({
    queryKey: searchKeys.results(request?.query ?? ''),
    queryFn: () => (request ? searchApi.search(request) : null),
    enabled: !!request?.query,
    staleTime: 5 * 60 * 1000, // Cache search results for 5 minutes
  });
}
