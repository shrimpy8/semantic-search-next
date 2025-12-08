import { debug } from '@/lib/debug';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

// Timeout configuration (in milliseconds)
const DEFAULT_TIMEOUT = 10000; // 10 seconds for regular requests
const SEARCH_TIMEOUT = 60000; // 60 seconds for search (RAG can be slow)
const UPLOAD_TIMEOUT = 60000; // 60 seconds for file uploads
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second base delay

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown
  ) {
    // Extract message from error response if available
    const errorMessage = (data as { message?: string; detail?: string })?.message
      || (data as { message?: string; detail?: string })?.detail
      || statusText;
    super(errorMessage);
    this.name = 'ApiError';
  }
}

export class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Fetch with timeout support using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(timeout);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Retry logic with exponential backoff
 * Only retries on network errors and 5xx server errors
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  timeout: number,
  retries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeout);

      // Don't retry on client errors (4xx) - these are intentional failures
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // Retry on server errors (5xx)
      if (response.status >= 500 && attempt < retries) {
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on timeout or abort
      if (error instanceof TimeoutError) {
        throw error;
      }

      // Retry on network errors
      if (attempt < retries) {
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}

async function handleResponse<T>(response: Response, method: string, endpoint: string): Promise<T> {
  if (!response.ok) {
    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    debug.error('API', `${method} ${endpoint} failed: ${response.status}`, data);
    throw new ApiError(response.status, response.statusText, data);
  }
  const result = await response.json();
  debug.log('API', `${method} ${endpoint} -> ${response.status}`, result);
  return result;
}

export const apiClient = {
  async get<T>(endpoint: string): Promise<T> {
    debug.log('API', `GET ${endpoint}`);
    const response = await fetchWithRetry(
      `${API_BASE_URL}${endpoint}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      DEFAULT_TIMEOUT
    );
    return handleResponse<T>(response, 'GET', endpoint);
  },

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    debug.log('API', `POST ${endpoint}`, data);
    const response = await fetchWithRetry(
      `${API_BASE_URL}${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      },
      DEFAULT_TIMEOUT
    );
    return handleResponse<T>(response, 'POST', endpoint);
  },

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    debug.log('API', `PATCH ${endpoint}`, data);
    const response = await fetchWithRetry(
      `${API_BASE_URL}${endpoint}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      },
      DEFAULT_TIMEOUT
    );
    return handleResponse<T>(response, 'PATCH', endpoint);
  },

  async delete<T>(endpoint: string): Promise<T> {
    debug.log('API', `DELETE ${endpoint}`);
    const response = await fetchWithRetry(
      `${API_BASE_URL}${endpoint}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      DEFAULT_TIMEOUT
    );
    return handleResponse<T>(response, 'DELETE', endpoint);
  },

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    debug.log('API', `UPLOAD ${endpoint}`, { files: Array.from(formData.keys()) });
    // Uploads get longer timeout and no retries (not idempotent)
    const response = await fetchWithTimeout(
      `${API_BASE_URL}${endpoint}`,
      {
        method: 'POST',
        body: formData,
      },
      UPLOAD_TIMEOUT
    );
    return handleResponse<T>(response, 'UPLOAD', endpoint);
  },

  /**
   * POST with extended timeout for slow operations (search with RAG)
   */
  async postSlow<T>(endpoint: string, data?: unknown): Promise<T> {
    debug.log('API', `POST (slow) ${endpoint}`, data);
    const response = await fetchWithRetry(
      `${API_BASE_URL}${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      },
      SEARCH_TIMEOUT
    );
    return handleResponse<T>(response, 'POST', endpoint);
  },
};
