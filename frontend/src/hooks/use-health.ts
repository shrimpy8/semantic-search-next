'use client';

import { useQuery } from '@tanstack/react-query';
import { healthApi } from '@/lib/api';

// Query keys
export const healthKeys = {
  all: ['health'] as const,
  check: () => [...healthKeys.all, 'check'] as const,
};

// Hooks

export function useHealthCheck() {
  return useQuery({
    queryKey: healthKeys.check(),
    queryFn: () => healthApi.check(),
    refetchInterval: 30000, // Check every 30 seconds
    retry: 1,
  });
}
