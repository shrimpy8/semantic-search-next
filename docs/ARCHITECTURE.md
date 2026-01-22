# Semantic Search Architecture

## System Overview

This is a production-grade semantic search system implementing **hybrid retrieval** (BM25 + semantic search) with optional **cross-encoder reranking** for maximum relevance.

## Legacy Modules (Not Wired in Current App)

The following modules remain in the codebase for reference only and are not used by the current FastAPI app:
- JSON storage + managers: `core/storage.py`, `core/document_manager.py`, `core/collection_manager.py`, `core/search_manager.py`
- Conversation history: `core/conversation.py`
- A/B testing: `core/ab_testing.py`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                   │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│  │   Next.js App   │    │   Search Page   │    │  Settings Page  │          │
│  │   (React 19)    │    │  + Collections  │    │  + Controls     │          │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘          │
└───────────┼──────────────────────┼──────────────────────┼───────────────────┘
            │                      │                      │
            └──────────────────────┼──────────────────────┘
                                   │ HTTP/REST
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     FastAPI Application                             │   │
│  │  /api/v1/collections  /api/v1/documents  /api/v1/search  /settings  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└───────────┬─────────────────────────────────────────────────┬───────────────┘
            │                                                 │
            ▼                                                 ▼
┌───────────────────────────┐                   ┌───────────────────────────┐
│       PostgreSQL          │                   │         ChromaDB          │
│   (Relational Metadata)   │                   │    (Vector Embeddings)    │
│                           │                   │                           │
│  • Collections            │                   │  • Document chunks        │
│  • Documents              │                   │  • 3072-dim vectors       │
│  • Settings               │                   │  • Metadata filters       │
│  • Search history         │                   │                           │
└───────────────────────────┘                   └───────────────────────────┘
                                                             │
                                                             ▼
                                               ┌───────────────────────────┐
                                               │     External APIs         │
                                               │                           │
                                               │  • OpenAI Embeddings      │
                                               │  • Jina Reranker          │
                                               │  • Cohere Reranker        │
                                               └───────────────────────────┘
```

---

## Data Storage Split

### PostgreSQL (Relational Metadata)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `collections` | Document collections | id, name, description, settings, document_count, chunk_count |
| `documents` | Uploaded files metadata | id, collection_id, filename, file_hash, status, page_count |
| `settings` | Application configuration | search defaults, display options, min_score_threshold |
| `search_queries` | Search analytics | query_text, latency_ms, results_count |

**Why PostgreSQL?**
- ACID transactions for data integrity
- Complex queries (JOINs, aggregations)
- Unique constraints for deduplication (file_hash per collection)
- Rich indexing (B-tree, GIN for JSONB)
- Relational integrity via foreign keys

### ChromaDB (Vector Store)

| Data | Purpose | Format |
|------|---------|--------|
| Embeddings | Semantic similarity search | 3072-dimensional float vectors |
| Chunk text | Retrieved content | Original text from documents |
| Metadata | Filtering and context | collection_id, document_id, page, source |

**Why ChromaDB?**
- Optimized for vector similarity (cosine distance)
- Efficient approximate nearest neighbor (ANN) search
- Metadata filtering at query time
- Horizontal scalability

**Single Collection Architecture:**
All chunks are stored in one ChromaDB collection (`semantic_search_docs`) with metadata-based filtering:
```python
# Filter by collection
filter={"collection_id": {"$eq": "abc-123"}}

# Filter by documents
filter={"document_id": {"$in": ["doc-1", "doc-2"]}}
```

---

## External Services

### OpenAI API

| Service | Model | Purpose | Dimensions |
|---------|-------|---------|------------|
| Embeddings | `text-embedding-3-large` | Convert text to vectors | 3072 |
| LLM | `gpt-4o-mini` | Answer generation, Evaluation | - |

**Embedding Flow:**
```
Text chunk (500 chars) → OpenAI API → 3072-dim vector → ChromaDB
```

### Anthropic API

| Service | Model | Purpose |
|---------|-------|---------|
| LLM | `claude-sonnet-4-20250514` | Answer generation, Evaluation |

### Ollama (Local)

| Service | Model | Purpose | Dimensions |
|---------|-------|---------|------------|
| Embeddings | `nomic-embed-text` | Local vector embeddings | 768 |
| Embeddings | `nomic-embed-text-v2-moe` | Local vector embeddings (MoE) | 768 |
| LLM | `llama3.2`, `mistral` | Answer generation, Evaluation | - |

### Jina AI

| Service | Model | Purpose |
|---------|-------|---------|
| Reranker | `jina-reranker-v2-base-multilingual` | Cross-encoder reranking |

### Cohere (Alternative)

| Service | Model | Purpose |
|---------|-------|---------|
| Reranker | `rerank-english-v3.0` | Cross-encoder reranking |

**Reranker Selection:**
```python
reranker_provider = "auto"  # Tries Jina → Cohere → None
```

---

## Data Flows

### Document Upload Flow

```
User Upload (PDF/TXT/MD)
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. VALIDATION                                                  │
│     • Check file extension (.pdf, .txt, .md)                    │
│     • Check file size (max 50MB)                                │
│     • Calculate SHA256 hash for deduplication                   │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. TEXT EXTRACTION (LangChain)                                 │
│     • PDF: PyPDFLoader (page-by-page extraction)                │
│     • TXT/MD: TextLoader                                        │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. CHUNKING (RecursiveCharacterTextSplitter)                   │
│     • chunk_size: 1000 characters                               │
│     • chunk_overlap: 200 characters                             │
│     • Preserves semantic boundaries (paragraphs, sentences)     │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. EMBEDDING (OpenAI API)                                      │
│     • Model: text-embedding-3-large                             │
│     • Output: 3072-dimensional float vector per chunk           │
│     • Batched for efficiency                                    │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. STORAGE                                                     │
│                                                                 │
│  PostgreSQL:                 ChromaDB:                          │
│  ┌───────────────────┐      ┌───────────────────┐               │
│  │ Document record   │      │ Chunks + vectors  │               │
│  │ • id              │      │ • embedding       │               │
│  │ • filename        │      │ • text content    │               │
│  │ • file_hash       │      │ • metadata:       │               │
│  │ • chunk_count     │      │   - collection_id │               │
│  │ • status: ready   │      │   - document_id   │               │
│  └───────────────────┘      │   - page          │               │
│                             │   - source        │               │
│                             └───────────────────┘               │
└─────────────────────────────────────────────────────────────────┘

Note: Original file is NOT stored. Only extracted chunks + embeddings are retained.
```

### Search Query Flow

```
User Query: "How does authentication work?"
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. QUERY EMBEDDING                                             │
│     • OpenAI text-embedding-3-large                             │
│     • Same model as document embeddings for consistency         │
│     • Output: 3072-dim query vector                             │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. PARALLEL RETRIEVAL                                          │
│                                                                 │
│  ┌─────────────────────┐    ┌─────────────────────┐             │
│  │  Semantic Search    │    │    BM25 Search      │             │
│  │  (ChromaDB)         │    │    (In-memory)      │             │
│  │                     │    │                     │             │
│  │  Cosine similarity  │    │  Term frequency     │             │
│  │  on embeddings      │    │  keyword matching   │             │
│  │                     │    │                     │             │
│  │  Returns: top 15    │    │  Returns: top 15    │             │
│  └─────────┬───────────┘    └─────────┬───────────┘             │
│            │                          │                         │
│            └──────────┬───────────────┘                         │
│                       ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  RECIPROCAL RANK FUSION (RRF)                               ││
│  │                                                             ││
│  │  score = α × 1/(k + semantic_rank) + (1-α) × 1/(k + bm25)   ││
│  │                                                             ││
│  │  α = 0.5 (balanced)  |  k = 60 (RRF constant)               ││
│  │                                                             ││
│  │  Deduplicates and merges results                            ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. RERANKING (Optional)                                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Cross-Encoder Reranker (Jina/Cohere)                       ││
│  │                                                             ││
│  │  • Takes query + each candidate passage                     ││
│  │  • Computes relevance score (0-1)                           ││
│  │  • More accurate than bi-encoder but slower                 ││
│  │  • Applied to top-K fusion results                          ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. CONFIDENCE FILTERING                                        │
│                                                                 │
│  Results split by min_score_threshold (default: 35%):           │
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────┐       │
│  │  HIGH CONFIDENCE        │  │  LOW CONFIDENCE         │       │
│  │  (final_score >= 0.35)  │  │  (final_score < 0.35)   │       │
│  │                         │  │                         │       │
│  │  Shown by default       │  │  Hidden by default      │       │
│  │  in results[]           │  │  in low_confidence[]    │       │
│  └─────────────────────────┘  └─────────────────────────┘       │
│                                                                 │
│  Threshold configurable in Settings (0-100%)                    │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. RESPONSE FORMATTING                                         │
│                                                                 │
│  {                                                              │
│    "query": "How does authentication work?",                    │
│    "results": [...],           // High-confidence results       │
│    "low_confidence_results": [...],  // Below threshold         │
│    "low_confidence_count": 3,  // Count of hidden results       │
│    "min_score_threshold": 0.35,  // Current threshold           │
│    "latency_ms": 245                                            │
│  }                                                              │
│                                                                 │
│  Each result contains:                                          │
│  {                                                              │
│    "content": "Authentication uses JWT tokens...",              │
│    "document_name": "security-guide.pdf",                       │
│    "collection_name": "Documentation",                          │
│    "page": 5,                                                   │
│    "scores": {                                                  │
│      "semantic_score": 0.85,   // Normalized 0-1                │
│      "bm25_score": 0.72,       // Normalized 0-1                │
│      "rerank_score": 0.92,     // Cross-encoder score 0-1       │
│      "final_score": 0.92,      // Used for ranking/filtering    │
│      "relevance_percent": 92   // Display value (0-100%)        │
│    }                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Retrieval Methods

| Method     | Alpha | Description            | Best For           |
|------------|-------|------------------------|--------------------|
| `semantic` | 1.0   | Pure vector similarity | Conceptual queries |
| `bm25`     | 0.0   | Pure keyword matching  | Exact term search  |
| `hybrid`   | 0.5   | Balanced fusion        | General search     |
| Custom     | 0-1   | User-defined blend     | Tuned use cases    |

**Alpha Parameter:**
```
α = 0.0: 100% keywords (BM25)
α = 0.5: 50/50 blend (default)
α = 1.0: 100% semantic
```

### AI Answer Generation Flow

When `generate_answer=true`:

**Answer Style Options:**
| Style | Description |
|-------|-------------|
| `concise` | Brief, to-the-point answers |
| `detailed` | Comprehensive explanations |
| `technical` | Technical language, assumes expertise |
| `conversational` | Friendly, accessible tone |

```
Search Results (Top K chunks)
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. CONTEXT ASSEMBLY                                            │
│     • Concatenate top K chunk contents                          │
│     • Include surrounding context (context_before/after)        │
│     • Format with source attribution                            │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. RAG GENERATION (QAChain)                                    │
│     • Model: gpt-4o-mini                                        │
│     • Prompt: External YAML (prompts/qa.yaml)                   │
│     • Instructions: Answer based only on provided context       │
│     • Output: Natural language answer                           │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. ANSWER VERIFICATION (AnswerVerifier)                        │
│                                                                 │
│  Step 1: Claim Extraction                                       │
│     • LLM extracts factual claims from answer                   │
│     • Returns numbered list of verifiable statements            │
│                                                                 │
│  Step 2: Claim Verification                                     │
│     • Each claim checked against source context                 │
│     • Status: SUPPORTED or NOT_SUPPORTED                        │
│     • Supporting quote extracted for citations                  │
│                                                                 │
│  Step 3: Confidence Calculation                                 │
│     • coverage = verified_claims / total_claims                 │
│     • ≥90%: HIGH | ≥60%: MEDIUM | ≥30%: LOW | <30%: UNVERIFIED  │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. RESPONSE                                                    │
│                                                                 │
│  {                                                              │
│    "answer": "Based on the documents...",                       │
│    "answer_verification": {                                     │
│      "confidence": "high",                                      │
│      "citations": [                                             │
│        {                                                        │
│          "claim": "The system uses...",                         │
│          "source_index": 0,                                     │
│          "source_name": "guide.pdf",                            │
│          "quote": "According to...",                            │
│          "verified": true                                       │
│        }                                                        │
│      ],                                                         │
│      "verified_claims": 3,                                      │
│      "total_claims": 3,                                         │
│      "coverage_percent": 100                                    │
│    }                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

### LLM-as-Judge Evaluation Flow

Evaluate search quality using an LLM judge to score relevance, faithfulness, and completeness.

```
Search Results + AI Answer
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. EVALUATION REQUEST                                          │
│     • Query, Answer, Retrieved Chunks                           │
│     • Ground truth (optional)                                   │
│     • Judge provider: OpenAI, Anthropic, or Ollama              │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. LLM JUDGE SCORING                                           │
│                                                                 │
│  Metrics evaluated (0-100 scale):                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  • Relevance: How relevant are chunks to the query?         ││
│  │  • Faithfulness: Is the answer grounded in chunks?          ││
│  │  • Completeness: Does answer fully address the query?       ││
│  │  • Context Precision: Are top chunks most relevant?         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. RESPONSE                                                    │
│                                                                 │
│  {                                                              │
│    "scores": {                                                  │
│      "relevance": 85,                                           │
│      "faithfulness": 90,                                        │
│      "completeness": 75,                                        │
│      "context_precision": 80                                    │
│    },                                                           │
│    "overall_score": 82.5,                                       │
│    "reasoning": "The answer accurately reflects...",            │
│    "suggestions": ["Consider adding..."]                        │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

**Judge Providers:**
| Provider | Model | Notes |
|----------|-------|-------|
| OpenAI | `gpt-4o-mini` | Fast, cost-effective |
| Anthropic | `claude-sonnet-4-20250514` | High quality |
| Ollama | `llama3.2`, `mistral` | Local, no API cost |

---

## API Endpoints

### Collections API

| Endpoint                     | Method | Description                 |
|------------------------------|--------------------------------------|
| `/api/v1/collections`        | POST   | Create collection           |
| `/api/v1/collections`        | GET    | List all collections        |
| `/api/v1/collections/{id}`   | GET    | Get collection details      |
| `/api/v1/collections/{id}`   | PATCH  | Update collection           |
| `/api/v1/collections/{id}`   | DELETE | Delete collection + chunks  |

### Documents API

| Endpoint                             |  Method | Description              |
|--------------------------------------|---------|--------------------------|
| `/api/v1/collections/{id}/documents` | POST    | Upload document          |
| `/api/v1/collections/{id}/documents` | GET     | List documents           |
| `/api/v1/documents/{id}`             | GET     | Get document details     |
| `/api/v1/documents/{id}`             | DELETE  | Delete document + chunks |

### Search API

| Endpoint         | Method | Description          |
|------------------|--------|----------------------|
| `/api/v1/search` | POST   | Execute search query |

**Request Body:**
```json
{
  "query": "authentication",
  "collection_id": "optional-uuid",
  "preset": "balanced",
  "top_k": 10,
  "alpha": 0.5,
  "use_reranker": true
}
```

### Settings API

| Endpoint                 | Method | Description          |
|--------------------------|--------|----------------------|
| `/api/v1/settings`       | GET    | Get current settings |
| `/api/v1/settings`       | PATCH  | Update settings      |
| `/api/v1/settings/reset` | POST   | Reset to defaults    |

### Evals API

| Endpoint                 | Method | Description                    |
|--------------------------|--------|--------------------------------|
| `/api/v1/evals/run`      | POST   | Run LLM-as-Judge evaluation    |
| `/api/v1/evals`          | GET    | List evaluation history        |
| `/api/v1/evals/{id}`     | GET    | Get evaluation details         |

### Analytics API

| Endpoint                       | Method | Description              |
|--------------------------------|--------|--------------------------|
| `/api/v1/analytics/searches`   | GET    | Search history (paginated) |
| `/api/v1/analytics/stats`      | GET    | Aggregate statistics     |
| `/api/v1/analytics/trends`     | GET    | Time-series data         |

### Health API

| Endpoint         | Method | Description         |
|------------------|--------|---------------------|
| `/api/v1/health` | GET    | System health check |

---

## Directory Structure

```
semantic-search-next/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── collections.py    # Collections CRUD
│   │   │   │   ├── documents.py      # Document upload/management
│   │   │   │   ├── search.py         # Search endpoint
│   │   │   │   ├── settings.py       # Settings API
│   │   │   │   └── health.py         # Health checks
│   │   │   ├── deps.py               # FastAPI dependencies
│   │   │   └── schemas.py            # Pydantic schemas
│   │   ├── core/
│   │   │   ├── vector_store.py       # ChromaDB integration
│   │   │   ├── hybrid_retriever.py   # RRF fusion logic
│   │   │   ├── bm25_retriever.py     # BM25 implementation
│   │   │   ├── reranker.py           # Jina/Cohere reranking
│   │   │   └── document_processor.py # Chunking logic
│   │   ├── db/
│   │   │   ├── models.py             # SQLAlchemy models
│   │   │   ├── session.py            # Database connection
│   │   │   └── repositories/         # Data access layer
│   │   ├── services/
│   │   │   └── retrieval.py          # Service layer
│   │   ├── config.py                 # Settings & env vars
│   │   └── main.py                   # FastAPI app
│   ├── alembic/                      # Database migrations
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Search page
│   │   │   ├── collections/          # Collections UI
│   │   │   └── settings/             # Settings page
│   │   ├── components/
│   │   │   ├── search/               # Search components
│   │   │   ├── collections/          # Collection components
│   │   │   └── ui/                   # shadcn/ui components
│   │   ├── lib/
│   │   │   └── api/                  # API clients
│   │   └── hooks/                    # React Query hooks
│   └── package.json
│
├── docker-compose.yml                # PostgreSQL + ChromaDB
└── ARCHITECTURE.md                   # This file
```

---

## Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=semantic_search
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# ChromaDB
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Optional - Reranking
JINA_API_KEY=jina_...
COHERE_API_KEY=...

# Retrieval Defaults
DEFAULT_HYBRID_ALPHA=0.5
USE_RERANKING=true
RERANKER_PROVIDER=auto

# Document Processing
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
EMBEDDING_MODEL=text-embedding-3-large
```

---

## Key Design Decisions

### 1. Single ChromaDB Collection
All chunks in one collection with metadata filtering vs. separate collections per user collection.
- **Pro:** Simpler management, no collection creation overhead
- **Con:** Relies on metadata filtering performance

### 2. BM25 In-Memory with Cache Invalidation
BM25 indices built in-memory per collection, cached for reuse.
- **Pro:** Fast, no external dependency
- **Con:** Memory usage scales with corpus size
- **Cache invalidation:** On document upload/delete, `invalidate_bm25_cache()` is called to rebuild index with new documents

### 3. Reciprocal Rank Fusion
RRF for combining semantic and BM25 results vs. linear score combination.
- **Pro:** Robust to score distribution differences
- **Con:** Ignores absolute score magnitudes

### 4. External Rerankers
Using Jina/Cohere APIs vs. local cross-encoder models.
- **Pro:** High quality, no GPU required
- **Con:** Latency, API costs, external dependency

### 5. No Original File Storage
Discarding original files after chunking.
- **Pro:** Lower storage costs, simpler architecture
- **Con:** Cannot re-download or re-process documents
