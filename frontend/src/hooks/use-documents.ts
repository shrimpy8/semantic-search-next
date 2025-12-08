'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { documentsApi } from '@/lib/api';
import { collectionKeys } from './use-collections';

// Query keys
export const documentKeys = {
  all: ['documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (collectionId: string) => [...documentKeys.lists(), collectionId] as const,
  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
  content: (id: string) => [...documentKeys.details(), id, 'content'] as const,
};

// Hooks

export function useDocuments(collectionId: string) {
  return useQuery({
    queryKey: documentKeys.list(collectionId),
    queryFn: () => documentsApi.list(collectionId),
    enabled: !!collectionId,
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => documentsApi.get(id),
    enabled: !!id,
  });
}

export function useDocumentContent(id: string) {
  return useQuery({
    queryKey: documentKeys.content(id),
    queryFn: () => documentsApi.getContent(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes (content doesn't change)
  });
}

export function useUploadDocument(collectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => documentsApi.upload(collectionId, file),
    onSuccess: (newDocument) => {
      // Invalidate documents list and collection (for updated counts)
      queryClient.invalidateQueries({ queryKey: documentKeys.list(collectionId) });
      queryClient.invalidateQueries({ queryKey: collectionKeys.detail(collectionId) });
      queryClient.invalidateQueries({ queryKey: collectionKeys.lists() });
      toast.success(`Document "${newDocument.filename}" uploaded`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload document: ${error.message}`);
    },
  });
}

export function useDeleteDocument(collectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: (_, id) => {
      // Remove from cache and invalidate
      queryClient.removeQueries({ queryKey: documentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.list(collectionId) });
      queryClient.invalidateQueries({ queryKey: collectionKeys.detail(collectionId) });
      queryClient.invalidateQueries({ queryKey: collectionKeys.lists() });
      toast.success('Document deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete document: ${error.message}`);
    },
  });
}
