'use client';

import { create } from 'zustand';
import type { SearchResponse, RetrievalPreset } from '@/lib/api';

interface SearchState {
  // Search parameters
  query: string;
  preset: RetrievalPreset;
  collectionId: string | undefined;
  topK: number;
  alpha: number;
  useReranker: boolean;

  // Search results
  results: SearchResponse | null;
  hasSearched: boolean;

  // Actions
  setQuery: (query: string) => void;
  setPreset: (preset: RetrievalPreset) => void;
  setCollectionId: (collectionId: string | undefined) => void;
  setTopK: (topK: number) => void;
  setAlpha: (alpha: number) => void;
  setUseReranker: (useReranker: boolean) => void;
  setResults: (results: SearchResponse | null) => void;
  setHasSearched: (hasSearched: boolean) => void;
  clearResults: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  // Default values
  query: '',
  preset: 'balanced',
  collectionId: undefined,
  topK: 10,
  alpha: 0.5,
  useReranker: true,
  results: null,
  hasSearched: false,

  // Actions
  setQuery: (query) => set({ query }),
  setPreset: (preset) => set({ preset }),
  setCollectionId: (collectionId) => set({ collectionId }),
  setTopK: (topK) => set({ topK }),
  setAlpha: (alpha) => set({ alpha }),
  setUseReranker: (useReranker) => set({ useReranker }),
  setResults: (results) => set({ results }),
  setHasSearched: (hasSearched) => set({ hasSearched }),
  clearResults: () => set({ results: null, hasSearched: false }),
}));
