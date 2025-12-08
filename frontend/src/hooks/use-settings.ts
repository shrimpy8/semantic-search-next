'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, type Settings, type SettingsUpdate } from '@/lib/api';
import { toast } from 'sonner';

const SETTINGS_QUERY_KEY = ['settings'];
const EMBEDDING_PROVIDERS_QUERY_KEY = ['embedding-providers'];

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => settingsApi.get(),
    staleTime: 60 * 1000, // Cache for 1 minute
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SettingsUpdate) => settingsApi.update(data),
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData<Settings>(SETTINGS_QUERY_KEY, updatedSettings);
      toast.success('Settings saved');
    },
    onError: () => {
      toast.error('Failed to save settings');
    },
  });
}

export function useResetSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => settingsApi.reset(),
    onSuccess: (defaultSettings) => {
      queryClient.setQueryData<Settings>(SETTINGS_QUERY_KEY, defaultSettings);
      toast.success('Settings reset to defaults');
    },
    onError: () => {
      toast.error('Failed to reset settings');
    },
  });
}

export function useEmbeddingProviders() {
  return useQuery({
    queryKey: EMBEDDING_PROVIDERS_QUERY_KEY,
    queryFn: () => settingsApi.getEmbeddingProviders(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
