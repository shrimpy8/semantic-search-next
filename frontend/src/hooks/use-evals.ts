'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  evalsApi,
  type EvaluateRequest,
  type EvaluationResultListParams,
  type EvaluationStatsParams,
  type GroundTruthCreate,
  type GroundTruthListParams,
  type GroundTruthUpdate,
} from '@/lib/api/evals';

// ============================================================================
// Query Keys for Cache Management
// ============================================================================

export const evalsKeys = {
  all: ['evals'] as const,
  // Ground Truth
  groundTruths: () => [...evalsKeys.all, 'ground-truths'] as const,
  groundTruthsList: (params: GroundTruthListParams) =>
    [...evalsKeys.groundTruths(), 'list', params] as const,
  groundTruthDetail: (id: string) =>
    [...evalsKeys.groundTruths(), 'detail', id] as const,
  // Evaluation Results
  results: () => [...evalsKeys.all, 'results'] as const,
  resultsList: (params: EvaluationResultListParams) =>
    [...evalsKeys.results(), 'list', params] as const,
  resultDetail: (id: string) =>
    [...evalsKeys.results(), 'detail', id] as const,
  // Stats
  stats: (params: EvaluationStatsParams) =>
    [...evalsKeys.all, 'stats', params] as const,
  // Providers
  providers: () => [...evalsKeys.all, 'providers'] as const,
};

// ============================================================================
// Ground Truth Hooks
// ============================================================================

/**
 * Hook to fetch paginated ground truths
 */
export function useGroundTruths(params: GroundTruthListParams = {}) {
  return useQuery({
    queryKey: evalsKeys.groundTruthsList(params),
    queryFn: () => evalsApi.listGroundTruths(params),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch a single ground truth
 */
export function useGroundTruth(id: string | null) {
  return useQuery({
    queryKey: evalsKeys.groundTruthDetail(id ?? ''),
    queryFn: () => evalsApi.getGroundTruth(id!),
    enabled: !!id,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to create a ground truth
 */
export function useCreateGroundTruth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GroundTruthCreate) => evalsApi.createGroundTruth(data),
    onSuccess: () => {
      // Invalidate ground truths list
      queryClient.invalidateQueries({ queryKey: evalsKeys.groundTruths() });
    },
  });
}

/**
 * Hook to update a ground truth
 */
export function useUpdateGroundTruth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: GroundTruthUpdate }) =>
      evalsApi.updateGroundTruth(id, data),
    onSuccess: (_, variables) => {
      // Invalidate specific ground truth and list
      queryClient.invalidateQueries({
        queryKey: evalsKeys.groundTruthDetail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: evalsKeys.groundTruths() });
    },
  });
}

/**
 * Hook to delete a ground truth
 */
export function useDeleteGroundTruth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => evalsApi.deleteGroundTruth(id),
    onSuccess: () => {
      // Invalidate ground truths list
      queryClient.invalidateQueries({ queryKey: evalsKeys.groundTruths() });
    },
  });
}

// ============================================================================
// Evaluation Results Hooks
// ============================================================================

/**
 * Hook to fetch paginated evaluation results
 */
export function useEvaluationResults(params: EvaluationResultListParams = {}) {
  return useQuery({
    queryKey: evalsKeys.resultsList(params),
    queryFn: () => evalsApi.listResults(params),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch a single evaluation result
 */
export function useEvaluationResult(id: string | null) {
  return useQuery({
    queryKey: evalsKeys.resultDetail(id ?? ''),
    queryFn: () => evalsApi.getResult(id!),
    enabled: !!id,
    staleTime: 60 * 1000, // 1 minute
  });
}

// ============================================================================
// Evaluation Stats Hook
// ============================================================================

/**
 * Hook to fetch evaluation statistics
 */
export function useEvaluationStats(params: EvaluationStatsParams = {}) {
  return useQuery({
    queryKey: evalsKeys.stats(params),
    queryFn: () => evalsApi.getStats(params),
    staleTime: 60 * 1000, // 1 minute
  });
}

// ============================================================================
// Run Evaluation Hook
// ============================================================================

/**
 * Hook to run an evaluation on a Q&A pair
 */
export function useRunEvaluation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: EvaluateRequest) => evalsApi.evaluate(data),
    onSuccess: () => {
      // Invalidate results and stats
      queryClient.invalidateQueries({ queryKey: evalsKeys.results() });
      queryClient.invalidateQueries({ queryKey: evalsKeys.all });
    },
  });
}

// ============================================================================
// Providers Hook
// ============================================================================

/**
 * Hook to fetch available judge providers
 */
export function useEvalProviders() {
  return useQuery({
    queryKey: evalsKeys.providers(),
    queryFn: () => evalsApi.getProviders(),
    staleTime: 5 * 60 * 1000, // 5 minutes (providers don't change often)
  });
}
