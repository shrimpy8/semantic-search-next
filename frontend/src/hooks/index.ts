// Collections
export {
  collectionKeys,
  useCollections,
  useCollection,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
} from './use-collections';

// Documents
export {
  documentKeys,
  useDocuments,
  useDocument,
  useDocumentContent,
  useUploadDocument,
  useDeleteDocument,
} from './use-documents';

// Search
export { searchKeys, useSearch, useSearchQuery } from './use-search';

// Settings
export {
  useSettings,
  useUpdateSettings,
  useResetSettings,
} from './use-settings';

// Health
export { healthKeys, useHealthCheck } from './use-health';

// Keyboard Shortcuts
export { useKeyboardShortcut } from './use-keyboard-shortcut';

// Analytics
export {
  analyticsKeys,
  useSearchHistory,
  useSearchStats,
  useSearchTrends,
  useTopQueries,
} from './use-analytics';
