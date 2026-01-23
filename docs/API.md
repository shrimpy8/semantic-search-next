# API Reference

> **Base URL**: `http://localhost:8080/api/v1`
> **Interactive Docs**: [Swagger UI](http://localhost:8080/api/v1/docs) | [ReDoc](http://localhost:8080/api/v1/redoc)

---

## Table of Contents

- [Health](#health)
- [Collections](#collections)
- [Documents](#documents)
- [Search](#search)
- [Settings](#settings)
- [Analytics](#analytics)
- [Evaluations](#evaluations)
- [Error Handling](#error-handling)

---

## Health

### GET /health
Basic health check.

**Response**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-22T19:00:00Z",
  "version": "0.1.0",
  "services": {
    "api": "healthy"
  }
}
```

### GET /health/ready
Readiness check including database and ChromaDB connectivity.

**Response**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-22T19:00:00Z",
  "version": "0.1.0",
  "services": {
    "api": "healthy",
    "database": "healthy",
    "chromadb": "healthy"
  }
}
```

---

## Collections

### POST /collections
Create a new document collection.

**Request Body**
```json
{
  "name": "Engineering Docs",
  "description": "Technical documentation",
  "metadata": {},
  "settings": {
    "default_retrieval_method": "hybrid",
    "default_top_k": 5,
    "use_reranking": true
  }
}
```

**Response** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Engineering Docs",
    "description": "Technical documentation",
    "document_count": 0,
    "chunk_count": 0,
    "created_at": "2026-01-22T19:00:00Z",
    "updated_at": "2026-01-22T19:00:00Z"
  },
  "message": "Collection 'Engineering Docs' created successfully",
  "warnings": []
}
```

### GET /collections
List all collections with cursor-based pagination.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 10 | Results per page (max 100) |
| `starting_after` | UUID | null | Cursor for pagination |

**Response**
```json
{
  "data": [...],
  "has_more": false,
  "total_count": 3,
  "next_cursor": null
}
```

### GET /collections/{collection_id}
Get a single collection by ID.

### PATCH /collections/{collection_id}
Update collection properties. Only provided fields are updated.

**Request Body**
```json
{
  "name": "Updated Name",
  "description": "New description"
}
```

### DELETE /collections/{collection_id}
Delete a collection and all its documents.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `force` | bool | false | Required if collection has documents |

**Response**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "object": "collection",
  "deleted": true
}
```

---

## Documents

### POST /collections/{collection_id}/documents
Upload a document to a collection. Supports PDF, TXT, and MD files.

**Request**: `multipart/form-data` with `file` field

**Constraints**
- Max file size: 50 MB
- Allowed extensions: `.pdf`, `.txt`, `.md`
- Duplicate files (same hash) are rejected

**Response** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "filename": "architecture.pdf",
  "collection_id": "550e8400-e29b-41d4-a716-446655440000",
  "file_hash": "abc123...",
  "file_size": 102400,
  "page_count": 15,
  "chunk_count": 42,
  "status": "ready",
  "uploaded_at": "2026-01-22T19:00:00Z"
}
```

**Status Values**: `processing`, `ready`, `error`

### GET /collections/{collection_id}/documents
List documents in a collection.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skip` | int | 0 | Offset for pagination |
| `limit` | int | 100 | Results per page |

### GET /documents/{document_id}
Get a single document by ID.

### GET /documents/{document_id}/content
Get all chunks for a document in order.

**Response**
```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440001",
  "filename": "architecture.pdf",
  "collection_id": "550e8400-e29b-41d4-a716-446655440000",
  "total_chunks": 42,
  "chunks": [
    {
      "id": "chunk_0",
      "content": "Introduction to the system...",
      "chunk_index": 0,
      "page": 1,
      "start_index": 0,
      "metadata": {}
    }
  ]
}
```

### DELETE /documents/{document_id}
Delete a document and its chunks from the vector store.

---

## Search

### POST /search
Execute a hybrid search query with optional AI answer generation.

**Request Body**
```json
{
  "query": "How does authentication work?",
  "collection_id": "550e8400-e29b-41d4-a716-446655440000",
  "preset": "balanced",
  "top_k": 10,
  "alpha": 0.5,
  "use_reranker": true,
  "generate_answer": true
}
```

**Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Search query (1-2000 chars) |
| `collection_id` | UUID | null | Scope to collection (null = all) |
| `document_ids` | UUID[] | null | Scope to specific documents |
| `preset` | string | "balanced" | `high_precision`, `balanced`, `high_recall` |
| `top_k` | int | from settings | Results to return (1-50) |
| `alpha` | float | from preset | Semantic weight (0=BM25, 1=semantic) |
| `use_reranker` | bool | from settings | Enable cross-encoder reranking |
| `generate_answer` | bool | false | Generate RAG answer |

**Preset Configurations**
| Preset | Alpha | Reranker | Use Case |
|--------|-------|----------|----------|
| `high_precision` | 0.85 | Yes | Exact matches, technical queries |
| `balanced` | 0.50 | Yes | General purpose |
| `high_recall` | 0.30 | Yes | Broad exploration |

**Response**
```json
{
  "query": "How does authentication work?",
  "results": [
    {
      "id": "chunk_0",
      "document_id": "550e8400-e29b-41d4-a716-446655440001",
      "document_name": "auth-guide.pdf",
      "collection_id": "550e8400-e29b-41d4-a716-446655440000",
      "collection_name": "Engineering Docs",
      "content": "Authentication is handled via JWT tokens...",
      "page": 5,
      "section": "Authentication Flow",
      "verified": true,
      "scores": {
        "semantic_score": 0.89,
        "bm25_score": 0.72,
        "rerank_score": 0.91,
        "final_score": 0.91,
        "relevance_percent": 91
      },
      "context_before": "Previous chunk content...",
      "context_after": "Next chunk content...",
      "chunk_index": 12,
      "total_chunks": 42
    }
  ],
  "low_confidence_results": [],
  "low_confidence_count": 0,
  "min_score_threshold": 0.35,
  "answer": "Authentication uses JWT tokens issued upon login...",
  "answer_verification": {
    "confidence": "high",
    "citations": [
      {
        "claim": "JWT tokens are used for authentication",
        "source_index": 0,
        "source_name": "auth-guide.pdf",
        "quote": "Authentication is handled via JWT tokens",
        "verified": true
      }
    ],
    "verified_claims": 3,
    "total_claims": 3,
    "coverage_percent": 100
  },
  "sources": ["auth-guide.pdf"],
  "latency_ms": 245,
  "retrieval_method": "balanced",
  "search_alpha": 0.5,
  "search_use_reranker": true,
  "reranker_provider": "jina",
  "chunk_size": 512,
  "chunk_overlap": 50,
  "embedding_model": "text-embedding-3-small",
  "answer_model": "gpt-4o-mini",
  "injection_warning": false,
  "injection_details": null
}
```

**Injection Warning** (M3A)

When potential prompt injection patterns are detected (score > 0.7):
```json
{
  "injection_warning": true,
  "injection_details": {
    "query": {
      "patterns": ["instruction_override"],
      "score": 0.8
    },
    "chunks": {
      "flagged_count": 1,
      "total_count": 10,
      "flagged": [
        {"index": 3, "patterns": ["delimiter_escape"], "score": 0.9}
      ]
    }
  }
}
```

---

## Settings

### GET /settings
Get current application settings.

**Response**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440099",
  "default_alpha": 0.5,
  "default_use_reranker": true,
  "default_preset": "balanced",
  "default_top_k": 10,
  "embedding_model": "text-embedding-3-small",
  "chunk_size": 512,
  "chunk_overlap": 50,
  "reranker_provider": "jina",
  "show_scores": false,
  "results_per_page": 10,
  "min_score_threshold": 0.35,
  "default_generate_answer": false,
  "context_window_size": 1,
  "eval_judge_provider": "openai",
  "eval_judge_model": "gpt-4o-mini",
  "answer_provider": "openai",
  "answer_model": "gpt-4o-mini",
  "answer_style": "balanced",
  "updated_at": "2026-01-22T19:00:00Z"
}
```

### PATCH /settings
Update settings. Only provided fields are updated.

**Request Body**
```json
{
  "default_alpha": 0.7,
  "answer_style": "detailed"
}
```

**Special: Changing Embedding Model**
```json
{
  "embedding_model": "text-embedding-3-large",
  "confirm_reindex": true
}
```
Requires `confirm_reindex: true` because existing documents must be re-indexed.

### POST /settings/reset
Reset all settings to defaults.

### GET /settings/validate
Validate system configuration. Cross-checks DB settings against environment variables.

**Response**
```json
{
  "ready": true,
  "checks": [
    {
      "name": "Embedding Provider",
      "status": "ok",
      "message": "Using openai (text-embedding-3-small)",
      "required": true
    },
    {
      "name": "Answer Provider",
      "status": "ok",
      "message": "Using openai (gpt-4o-mini) for AI answers",
      "required": true
    }
  ],
  "summary": "All systems configured and ready"
}
```

**Status Values**: `ok`, `warning`, `error`, `not_configured`

### GET /settings/embedding-providers
Get available embedding providers with models and availability.

### GET /settings/llm-models
Get available LLM models for answer generation and evaluation.

### GET /settings/providers
Get comprehensive provider availability information.

---

## Analytics

### GET /analytics/searches
Get paginated search history.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 50 | Results per page (max 200) |
| `offset` | int | 0 | Pagination offset |
| `collection_id` | UUID | null | Filter by collection |
| `start_date` | datetime | null | Filter from date |
| `end_date` | datetime | null | Filter to date |

### GET /analytics/stats
Get aggregated search statistics.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `collection_id` | UUID | null | Filter by collection |
| `days` | int | 30 | Days to include (1-365) |

**Response**
```json
{
  "total_searches": 1500,
  "avg_latency_ms": 185.5,
  "success_rate": 94.2,
  "successful_searches": 1413,
  "zero_results_count": 87,
  "searches_by_preset": {
    "balanced": 1200,
    "high_precision": 250,
    "high_recall": 50
  },
  "period_days": 30
}
```

### GET /analytics/trends
Get time-series search trends.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `collection_id` | UUID | null | Filter by collection |
| `days` | int | 30 | Days to include |
| `granularity` | string | "day" | `hour`, `day`, `week` |

### GET /analytics/top-queries
Get most frequent search queries.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 10 | Max queries (1-50) |
| `collection_id` | UUID | null | Filter by collection |
| `days` | int | 30 | Days to include |

---

## Evaluations

### POST /evals/evaluate
Run LLM-as-judge evaluation on a Q&A pair.

**Request Body**
```json
{
  "query": "What is the refund policy?",
  "answer": "Customers can request refunds within 30 days...",
  "chunks": [
    {
      "content": "Our refund policy allows...",
      "source": "policies.pdf",
      "metadata": {}
    }
  ],
  "ground_truth_id": null,
  "search_query_id": null,
  "provider": "openai",
  "model": "gpt-4o-mini",
  "search_alpha": 0.5,
  "search_preset": "balanced",
  "search_use_reranker": true
}
```

**Response** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440010",
  "query": "What is the refund policy?",
  "generated_answer": "Customers can request refunds within 30 days...",
  "judge_provider": "openai",
  "judge_model": "gpt-4o-mini",
  "scores": {
    "context_relevance": 0.92,
    "context_precision": 0.88,
    "context_coverage": 0.85,
    "faithfulness": 0.95,
    "answer_relevance": 0.90,
    "completeness": 0.87,
    "retrieval_score": 0.88,
    "answer_score": 0.91,
    "overall_score": 0.89
  },
  "search_config": {
    "search_alpha": 0.5,
    "search_preset": "balanced",
    "search_use_reranker": true
  },
  "eval_latency_ms": 1250,
  "created_at": "2026-01-22T19:00:00Z"
}
```

### GET /evals/results
List evaluation results with pagination.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `ground_truth_id` | UUID | null | Filter by ground truth |
| `search_query_id` | UUID | null | Filter by search query |
| `limit` | int | 20 | Results per page |
| `starting_after` | UUID | null | Cursor for pagination |

### GET /evals/results/{result_id}
Get a single evaluation result.

### GET /evals/stats
Get aggregate evaluation statistics.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | int | 30 | Days to include (1-365) |

**Response**
```json
{
  "total_evaluations": 150,
  "avg_overall_score": 0.82,
  "avg_retrieval_score": 0.85,
  "avg_answer_score": 0.79,
  "excellent_count": 45,
  "good_count": 75,
  "moderate_count": 25,
  "poor_count": 5,
  "period_days": 30
}
```

### GET /evals/providers
List available LLM judge providers.

**Response**
```json
{
  "available": ["openai", "anthropic"],
  "registered": ["openai", "anthropic", "ollama"]
}
```

### Ground Truth Management

#### POST /evals/ground-truths
Create a ground truth entry.

**Request Body**
```json
{
  "collection_id": "550e8400-e29b-41d4-a716-446655440000",
  "query": "What is the return policy?",
  "expected_answer": "Customers can return items within 30 days for a full refund.",
  "expected_sources": ["policies.pdf"],
  "notes": "Updated Q1 2026"
}
```

#### GET /evals/ground-truths
List ground truths with optional collection filter.

#### GET /evals/ground-truths/{ground_truth_id}
Get a single ground truth.

#### PUT /evals/ground-truths/{ground_truth_id}
Update a ground truth.

#### DELETE /evals/ground-truths/{ground_truth_id}
Delete a ground truth.

---

## Error Handling

All errors follow RFC 7807 inspired format:

```json
{
  "error": "not_found",
  "message": "Collection '550e8400-e29b-41d4-a716-446655440000' not found",
  "status_code": 404,
  "details": []
}
```

**Common Status Codes**
| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate resource |
| 413 | Payload Too Large - File exceeds 50MB |
| 500 | Internal Server Error |
| 503 | Service Unavailable - Provider not configured |

**Validation Errors** (400)
```json
{
  "error": "validation_error",
  "message": "Request validation failed",
  "status_code": 400,
  "details": [
    {
      "loc": ["body", "query"],
      "msg": "String should have at least 1 character",
      "type": "string_too_short"
    }
  ]
}
```

---

## Rate Limiting

In-memory rate limiting is applied:
- Default: 100 requests per minute per IP
- Configurable via environment variables

Headers returned:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706036400
```

---

## Request ID Tracking

All requests include a unique request ID for debugging:

**Response Header**
```
X-Request-ID: 1bb1ee4a
```

Include this ID when reporting issues.
