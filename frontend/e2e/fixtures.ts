/**
 * Shared E2E test fixtures and helpers.
 *
 * Provides API helpers to create/cleanup test data, plus common
 * page object patterns for navigation.
 */

const API_BASE = 'http://localhost:8080/api/v1';

/** Create a collection via the backend API. Returns the collection data. */
export async function createCollection(
  name: string,
  opts: { is_trusted?: boolean; description?: string } = {},
) {
  const res = await fetch(`${API_BASE}/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      description: opts.description ?? `E2E test collection: ${name}`,
      is_trusted: opts.is_trusted ?? false,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create collection "${name}": ${res.status} ${text}`);
  }
  const body = await res.json();
  return body.data; // OperationResult wraps in .data
}

/** Delete a collection via the backend API. */
export async function deleteCollection(id: string) {
  const res = await fetch(`${API_BASE}/collections/${id}?force=true`, {
    method: 'DELETE',
  });
  // Ignore 404 (already deleted) and 429 (rate limited during cleanup)
  if (!res.ok && res.status !== 404 && res.status !== 429) {
    const text = await res.text();
    throw new Error(`Failed to delete collection "${id}": ${res.status} ${text}`);
  }
}

/** Update a collection via the backend API. */
export async function updateCollection(
  id: string,
  data: { name?: string; is_trusted?: boolean; description?: string },
) {
  const res = await fetch(`${API_BASE}/collections/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update collection "${id}": ${res.status} ${text}`);
  }
  return res.json();
}

/** Execute a search via the backend API. Returns the raw SearchResponse. */
export async function searchAPI(
  query: string,
  opts: { collection_id?: string; generate_answer?: boolean } = {},
) {
  const res = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      collection_id: opts.collection_id,
      generate_answer: opts.generate_answer ?? false,
      preset: 'balanced',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Search failed: ${res.status} ${text}`);
  }
  return res.json();
}

/** Generate a unique name for test data to avoid collisions. */
export function uniqueName(prefix: string): string {
  return `${prefix}-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
