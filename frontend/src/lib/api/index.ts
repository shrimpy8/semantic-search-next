export { apiClient, ApiError } from './client';
export { collectionsApi } from './collections';
export type {
  Collection,
  CreateCollectionRequest,
  UpdateCollectionRequest,
  CollectionListResponse,
} from './collections';
export { documentsApi } from './documents';
export type {
  Document,
  DocumentListResponse,
  DocumentChunk,
  DocumentContentResponse,
} from './documents';
export { searchApi } from './search';
export type {
  RetrievalPreset,
  SearchRequest,
  SearchResult,
  SearchScores,
  SearchResponse,
} from './search';
export { settingsApi } from './settings';
export type {
  Settings,
  SettingsUpdate,
  EmbeddingModelInfo,
  EmbeddingProviderInfo,
  EmbeddingProvidersResponse,
} from './settings';
export { healthApi } from './health';
export type { HealthResponse } from './health';
export { analyticsApi } from './analytics';
export type {
  SearchQueryRecord,
  SearchHistoryResponse,
  SearchStatsResponse,
  TrendDataPoint,
  SearchTrendsResponse,
  TopQueryRecord,
  TopQueriesResponse,
  SearchHistoryParams,
  StatsParams,
  TrendsParams,
  TopQueriesParams,
} from './analytics';
