# CLAUDE.md - Semantic Search Next

> **Purpose**: Project-specific learnings, patterns, and best practices for Claude Code sessions.

---

## Project Overview

**Type**: Full-stack semantic search application with RAG capabilities
**Frontend**: Next.js 16 + TypeScript + Tailwind CSS + Shadcn/ui
**Backend**: FastAPI + SQLAlchemy 2.0 + PostgreSQL + ChromaDB
**Embeddings**: OpenAI text-embedding-3-large
**LLM**: OpenAI gpt-4o-mini
**Reranker**: Jina (local) / Cohere (cloud)
**Status**: Stage 2 Complete (UI), Stage 1 Integration In Progress

## Quick Start Commands

```bash
# Start all infrastructure
docker-compose up -d

# Backend (port 8080)
cd backend
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8080

# Frontend (port 3000)
cd frontend
npm install
npm run dev

# Run tests
cd frontend && npm test
cd backend && pytest
```

## Architecture

```
semantic-search-next/
├── frontend/                 # Next.js 16 App Router
│   ├── src/
│   │   ├── app/             # Pages (/, /collections, /collections/[id])
│   │   ├── components/      # React components
│   │   ├── hooks/           # TanStack Query hooks
│   │   └── lib/api/         # API client
│   └── package.json
├── backend/                  # FastAPI
│   ├── app/
│   │   ├── api/             # REST endpoints
│   │   ├── core/            # Business logic (search, vector store, etc.)
│   │   ├── db/              # SQLAlchemy models & repositories
│   │   └── models/          # Data models & errors
│   └── requirements.txt
└── docker-compose.yml        # PostgreSQL, pgAdmin, ChromaDB
```

## Coding Standards (MANDATORY)

### 1. DRY Principle - No Repeated Code

**Use helper functions in `app/api/deps.py`:**

```python
# GOOD - Use helpers
from app.api.deps import require_collection, require_document, check_collection_name_unique

collection = await require_collection(collection_id, repo)  # Raises 404 if not found
document = await require_document(document_id, repo)        # Raises 404 if not found
await check_collection_name_unique(name, repo)              # Raises 409 if duplicate

# BAD - Don't repeat this pattern everywhere
collection = await repo.get_by_id(collection_id)
if not collection:
    raise HTTPException(status_code=404, detail=f"Collection '{collection_id}' not found")
```

### 2. Logging - Every Module Must Have Logger

```python
# At top of every Python file
import logging
logger = logging.getLogger(__name__)

# Use appropriate levels
logger.debug("Detailed debugging info")
logger.info("Normal operations")
logger.warning("Something unexpected but handled")
logger.error("Error that needs attention")
logger.exception("Error with stack trace")
```

### 3. Error Handling - Use Custom Error Classes

**Backend error hierarchy in `app/models/errors.py`:**

```python
from app.models.errors import ValidationError, NotFoundError, DuplicateError, LimitExceededError

# These are automatically converted to proper HTTP responses by middleware:
# ValidationError -> 400 Bad Request
# NotFoundError   -> 404 Not Found
# DuplicateError  -> 409 Conflict
# LimitExceededError -> 429 Too Many Requests

raise NotFoundError(
    message=f"Document '{doc_id}' not found",
    param="document_id",
    resource_type="document",
    resource_id=str(doc_id)
)
```

**Frontend error handling:**

```typescript
// Use try-catch with toast notifications
try {
  await api.collections.create(data);
  toast.success("Collection created");
} catch (error) {
  toast.error(error instanceof Error ? error.message : "Failed to create collection");
}
```

### 4. API Response Format (Stripe-like)

**Success responses:**
```json
{
  "data": { ... },
  "has_more": false,
  "total_count": 10,
  "next_cursor": null
}
```

**Error responses:**
```json
{
  "error": "not_found",
  "message": "Collection 'abc123' not found",
  "status_code": 404,
  "details": [],
  "param": "collection_id"
}
```

### 5. Type Safety

**Backend - Full type hints:**
```python
async def get_collection(
    collection_id: UUID,
    repo: CollectionRepo,
) -> CollectionResponse:
```

**Frontend - TypeScript strict mode:**
```typescript
interface SearchResult {
  id: string;
  document_id: string;
  content: string;
  scores: SearchScores;
}
```

### 6. Database Patterns

**Use repository pattern:**
```python
# Repositories in app/db/repositories/
class CollectionRepository(BaseRepository[Collection]):
    async def get_by_name(self, name: str) -> Collection | None: ...
    async def list_with_pagination(self, limit: int, starting_after: UUID | None) -> tuple[list[Collection], bool]: ...
```

**SQLAlchemy model naming:**
- Use `metadata_` for JSONB metadata (avoids SQLAlchemy conflict)
- Use `settings` for JSONB settings
- Always include `created_at`, `updated_at` timestamps

### 7. Frontend Patterns

**Use TanStack Query hooks:**
```typescript
// All API calls go through hooks in src/hooks/
const { data, isLoading, error } = useCollections();
const createMutation = useCreateCollection();
```

**Component organization:**
```
components/
├── ui/           # Shadcn base components
├── layout/       # Header, providers, theme
├── collections/  # Collection-specific components
├── documents/    # Document-specific components
└── search/       # Search-specific components
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Basic health check |
| GET | `/api/v1/health/ready` | Full readiness (DB + ChromaDB) |
| GET/POST | `/api/v1/collections` | List/Create collections |
| GET/PATCH/DELETE | `/api/v1/collections/{id}` | CRUD single collection |
| POST | `/api/v1/collections/{id}/documents` | Upload document |
| GET | `/api/v1/collections/{id}/documents` | List documents |
| DELETE | `/api/v1/documents/{id}` | Delete document |
| POST | `/api/v1/search` | Execute search |

## Environment Variables

**Backend (.env):**
```
# Database
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=semantic_search
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Vector Store
CHROMA_HOST=localhost
CHROMA_PORT=8000

# API Keys
OPENAI_API_KEY=sk-...
COHERE_API_KEY=...  # Optional, for reranking

# Debug Mode (CRITICAL for troubleshooting)
# Set DEBUG=true to enable DEBUG level logging
# Set DEBUG=false (default) for INFO level logging in production
DEBUG=false
```

**Frontend (.env.local):**
```
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
```

## Known Issues / TODOs

### Critical (Core functionality gaps)
- [ ] Search endpoint returns empty results - needs SearchManager integration
- [ ] Document upload doesn't trigger processing/indexing to ChromaDB
- [ ] RAG answer generation incomplete in qa_chain.py

### High Priority
- [ ] Reranker implementation incomplete (CohereReranker skeleton only)
- [ ] ChromaDB cleanup on document delete not implemented
- [ ] Frontend missing Edit Collection dialog

### Medium Priority
- [ ] A/B testing execution logic incomplete
- [ ] Conversation manager incomplete
- [ ] Frontend pagination for large datasets

## Testing

**Backend:**
```bash
cd backend
pytest                    # Run all tests
pytest -v                 # Verbose
pytest tests/test_api.py  # Specific file
```

**Frontend:**
```bash
cd frontend
npm test                  # Run Jest tests
npm test -- --watch       # Watch mode
npm test -- --coverage    # Coverage report
```

## Git Workflow

- Main branch: `main`
- Feature branches: `feature/description`
- Bug fixes: `fix/description`
- Always run tests before committing
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`

## Performance Considerations

- Backend uses async/await throughout
- Database queries use proper indexes
- Frontend uses React Query with stale-while-revalidate
- Health check caches ChromaDB status for 5 seconds

## Security

- API keys in environment variables only
- CORS configured for localhost:3000 only
- File uploads validated (PDF/TXT/MD/DOCX, 50MB max)
- SQL injection prevented via SQLAlchemy ORM
- XSS prevented via React's automatic escaping

---

## Retrieval System

### Hybrid Search Formula
```
final_score = (alpha × semantic_score) + ((1 - alpha) × bm25_score)
```

- `alpha = 1.0`: Pure semantic search
- `alpha = 0.0`: Pure BM25 (keyword) search
- `alpha = 0.5`: Balanced hybrid

### Retrieval Presets
| Preset | k | alpha | Rerank | Use Case |
|--------|---|-------|--------|----------|
| High Precision | 3 | 0.7 | Yes | Specific questions |
| Balanced | 5 | 0.5 | Yes | General use |
| High Recall | 10 | 0.3 | No | Exploration |

### Reranker Priority (Auto Mode)
1. **Jina (local)**: No API cost, no network latency
2. **Cohere (cloud)**: Fallback if Jina unavailable

---

## ChromaDB Patterns

### Metadata Filtering (CRITICAL)
ChromaDB requires explicit operators - direct equality doesn't work:

```python
# WRONG - will fail silently
where = {"collection_id": "col-123"}

# CORRECT - use explicit $eq operator
where = {"collection_id": {"$eq": "col-123"}}

# Multiple values
where = {"document_id": {"$in": ["doc-1", "doc-2"]}}

# Compound filters use $and/$or at top level
where = {
    "$and": [
        {"collection_id": {"$eq": "col-123"}},
        {"document_id": {"$eq": "doc-456"}}
    ]
}
```

### Document ID Consistency
Always use the same ID generation pattern:
```python
document_id = f"doc-{uuid.uuid4().hex[:8]}"
chunk_id = f"{document_id}-chunk-{index}"
```

---

## Common Pitfalls & Solutions

### 1. SQLAlchemy metadata Conflict
**Problem**: `metadata` attribute conflicts with SQLAlchemy Base class
```python
# WRONG - conflicts with SQLAlchemy
metadata: Mapped[dict] = mapped_column(JSONB)

# CORRECT - use metadata_ with column alias
metadata_: Mapped[dict] = mapped_column("metadata", JSONB)
```

**Pydantic fix**: Use `validation_alias` to read from `metadata_`:
```python
metadata: dict[str, Any] = Field(default_factory=dict, validation_alias="metadata_")
```

### 2. Async Database Operations
**Problem**: Forgetting await on async operations
```python
# WRONG - returns coroutine, not result
collection = repo.get_by_id(id)

# CORRECT
collection = await repo.get_by_id(id)
```

### 3. Empty State Handling
**Problem**: UI crashes when no data exists
```typescript
// Always handle empty states
if (!collections?.length) {
  return <EmptyState message="No collections yet" />;
}
```

### 4. Toast Notifications
**Problem**: Inconsistent feedback
```typescript
// Always provide feedback for mutations
try {
  await mutation.mutateAsync(data);
  toast.success("Operation successful");
} catch (error) {
  toast.error(error.message || "Operation failed");
}
```

---

## Data Models

### Response Objects Pattern
Always wrap operations in typed responses:

```python
@dataclass
class OperationResult(Generic[T]):
    success: bool
    data: T | None = None
    message: str | None = None
    warnings: list[str] = field(default_factory=list)
```

### Chunking Strategy
- Default chunk size: 1000 characters
- Overlap: 200 characters
- Balance between context and precision

---

## Key Files to Understand

### Backend
1. `app/core/search_manager.py` - Search orchestration
2. `app/core/vector_store.py` - ChromaDB integration
3. `app/core/hybrid_retriever.py` - BM25 + Semantic fusion
4. `app/api/deps.py` - DRY helper functions
5. `app/models/errors.py` - Custom error classes

### Frontend
1. `src/hooks/` - TanStack Query hooks
2. `src/lib/api/` - API client
3. `src/components/search/` - Search UI components

---

## Migration from Stage 1 (Streamlit)

| Stage 1 (Streamlit) | Stage 2 (Next.js + FastAPI) |
|---------------------|----------------------------|
| `core/collection_manager.py` | `app/db/repositories/collection_repo.py` |
| `core/document_manager.py` | `app/db/repositories/document_repo.py` |
| `core/search_manager.py` | `app/core/search_manager.py` (ported) |
| `core/vector_store.py` | `app/core/vector_store.py` (ported) |
| `config.yaml` | Environment variables + `app/config.py` |
| JSON storage | PostgreSQL + SQLAlchemy |
| Streamlit session state | TanStack Query cache |
