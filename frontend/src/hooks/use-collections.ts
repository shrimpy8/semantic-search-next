'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  collectionsApi,
  type CreateCollectionRequest,
  type UpdateCollectionRequest,
} from '@/lib/api';

// Query keys
export const collectionKeys = {
  all: ['collections'] as const,
  lists: () => [...collectionKeys.all, 'list'] as const,
  list: (filters: { limit?: number; startingAfter?: string }) =>
    [...collectionKeys.lists(), filters] as const,
  details: () => [...collectionKeys.all, 'detail'] as const,
  detail: (id: string) => [...collectionKeys.details(), id] as const,
};

// Hooks

export function useCollections(options?: { limit?: number; startingAfter?: string }) {
  return useQuery({
    queryKey: collectionKeys.list(options ?? {}),
    queryFn: () => collectionsApi.list(),
  });
}

export function useCollection(id: string) {
  return useQuery({
    queryKey: collectionKeys.detail(id),
    queryFn: () => collectionsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCollectionRequest) => collectionsApi.create(data),
    onSuccess: (newCollection) => {
      // Invalidate and refetch collections list
      queryClient.invalidateQueries({ queryKey: collectionKeys.lists() });
      toast.success(`Collection "${newCollection.name}" created`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create collection: ${error.message}`);
    },
  });
}

export function useUpdateCollection(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateCollectionRequest) => collectionsApi.update(id, data),
    onSuccess: (updatedCollection) => {
      // Update cache
      queryClient.setQueryData(collectionKeys.detail(id), updatedCollection);
      queryClient.invalidateQueries({ queryKey: collectionKeys.lists() });
      toast.success('Collection updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update collection: ${error.message}`);
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => collectionsApi.delete(id),
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: collectionKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: collectionKeys.lists() });
      toast.success('Collection deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete collection: ${error.message}`);
    },
  });
}
