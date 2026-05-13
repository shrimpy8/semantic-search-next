import { apiClient } from './client';

export interface Document {
  id: string;
  collection_id: string;
  filename: string;
  file_hash: string;
  file_size: number;
  page_count?: number;
  chunk_count: number;
  metadata?: Record<string, unknown>;
  status: 'processing' | 'ready' | 'error';
  uploaded_at: string;
}

export interface DocumentListResponse {
  data: Document[];
  total: number;
}

// Document content/chunk types
export interface DocumentChunk {
  id: string;
  content: string;
  chunk_index: number;
  page: number | null;
  start_index: number | null;
  metadata: Record<string, unknown>;
}

export interface DocumentContentResponse {
  document_id: string;
  filename: string;
  collection_id: string;
  total_chunks: number;
  chunks: DocumentChunk[];
}

export const documentsApi = {
  list: (collectionId: string) =>
    apiClient.get<DocumentListResponse>(`/collections/${encodeURIComponent(collectionId)}/documents`),

  get: (id: string) => apiClient.get<Document>(`/documents/${encodeURIComponent(id)}`),

  getContent: (id: string) => apiClient.get<DocumentContentResponse>(`/documents/${encodeURIComponent(id)}/content`),

  upload: (collectionId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.upload<Document>(`/collections/${encodeURIComponent(collectionId)}/documents`, formData);
  },

  delete: (id: string) => apiClient.delete<void>(`/documents/${encodeURIComponent(id)}`),
};
