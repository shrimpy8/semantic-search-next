# Semantic Search Next

AI-powered document search with hybrid retrieval, intelligent reranking, and confidence-based filtering.

## Features

- **Hybrid Retrieval**: Combines BM25 keyword search with semantic embeddings using Reciprocal Rank Fusion (RRF)
- **AI Answer Generation**: RAG-powered answers with citation verification and hallucination detection
- **AI Reranking**: Uses Jina cross-encoder (local) or Cohere API to rerank results for relevance
- **Confidence Filtering**: Separates high-confidence from low-confidence results based on configurable threshold
- **Answer Verification**: Extracts claims from AI answers and verifies them against source documents
- **Search Analytics**: Dashboard with search history, latency trends, and usage statistics
- **Document Preview**: View full document content with chunk navigation
- **Collection Scoping**: Search across all documents or within specific collections
- **Retrieval Presets**: High Precision / Balanced / High Recall modes
- **Score Transparency**: View semantic, BM25, rerank, and final scores on results
- **Multiple Providers**: Support for OpenAI, Ollama (local), Jina, Cohere, and Voyage AI embeddings
- **Dark Mode**: Full theme support with system preference detection

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│                    Next.js 15 (App Router)                      │
│              Shadcn/ui + Tailwind + TypeScript                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP/REST
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                 │
│                      FastAPI (Python)                           │
│  ┌─────────────┬─────────────┬─────────────┬─────────────────┐  │
│  │ Collections │  Documents  │   Search    │    Settings     │  │
│  │   API       │    API      │    API      │      API        │  │
│  └──────┬──────┴──────┬──────┴──────┬──────┴────────┬────────┘  │
│         │             │             │               │           │
│  ┌──────▼─────────────▼─────────────▼───────────────▼────────┐  │
│  │                    CORE SERVICES                          │  │
│  │  HybridSearchService │ Reranker │ VectorStore │ BM25Cache │  │
│  └──────┬───────────────┴──────────┴─────────────┬───────────┘  │
└─────────┼────────────────────────────────────────┼──────────────┘
          │                                        │
          ▼                                        ▼
┌─────────────────────┐                 ┌─────────────────────────┐
│     PostgreSQL      │                 │       ChromaDB          │
│  (Metadata + Config)│                 │    (Vector Store)       │
└─────────────────────┘                 └─────────────────────────┘
```

## Search Flow

1. **Query Embedding** - Generate embedding via OpenAI `text-embedding-3-large`
2. **Parallel Retrieval**:
   - Semantic search via ChromaDB (cosine similarity)
   - BM25 keyword search (in-memory, per-collection cache with auto-invalidation)
3. **Reciprocal Rank Fusion (RRF)** - Merge results with configurable alpha
4. **Reranking** - Jina cross-encoder (local) or Cohere API
5. **Confidence Filtering** - Split results by `min_score_threshold` (default: 30%)
6. **Response** - High-confidence results + hidden low-confidence results

## Tech Stack

### Backend
- **FastAPI** - Python web framework with async support
- **PostgreSQL** - Relational database (metadata, settings, search history)
- **ChromaDB** - Vector database for semantic search
- **OpenAI** - Embeddings (`text-embedding-3-large`)
- **Jina/Cohere** - Cross-encoder reranking
- **BM25** - Keyword search via `rank_bm25`

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Shadcn/ui** - Component library
- **Lucide** - Icons

## Prerequisites

- Node.js 18+
- Python 3.11+
- Docker & Docker Compose

> **Detailed Setup Guide**: See [INFRASTRUCTURE.md](./docs/INFRASTRUCTURE.md) for comprehensive setup instructions including:
> - PostgreSQL & ChromaDB configuration
> - Local AI providers (Ollama, Jina reranker)
> - Cloud provider setup (OpenAI, Cohere, Voyage AI)
> - Troubleshooting guide

## Quick Start

### 1. Clone and setup environment

```bash
git clone https://github.com/shrimpy8/semantic-search-next.git
cd semantic-search-next

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Edit with your API keys
```

### 2. Start Docker Services

```bash
# Start PostgreSQL + pgAdmin
docker-compose up -d

# Start ChromaDB (separate container)
docker run -d --name chromadb -p 8000:8000 chromadb/chroma
```

Services started:
- **PostgreSQL**: `localhost:5432`
- **ChromaDB**: `localhost:8000`
- **pgAdmin**: `http://localhost:3001` (login: `admin@local.dev` / `admin`)

### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate   # Windows

# Install dependencies
pip install -e ".[dev]"

# Run FastAPI server
uvicorn app.main:app --reload --port 8080
```

- API: `http://localhost:8080`
- Swagger docs: `http://localhost:8080/docs`

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend: `http://localhost:3000`

## Environment Variables

Copy `.env.example` files in `backend/` and `frontend/` directories. See `.env.example` for comprehensive documentation.

### Backend (backend/.env)

```env
# Debug Mode
DEBUG=false                          # Set true for verbose logging

# OpenAI (required for default config)
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-large
LLM_MODEL=gpt-4o-mini

# Alternative Embedding Providers (optional)
OLLAMA_BASE_URL=http://localhost:11434  # Local, no API key needed
JINA_API_KEY=...                         # Free tier: 1M tokens/mo
COHERE_API_KEY=...                       # Also used for reranking
VOYAGE_API_KEY=...                       # RAG optimized

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=semantic_search
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# ChromaDB
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Reranking
RERANKER_PROVIDER=auto               # auto | jina | cohere
USE_RERANKING=true
```

### Frontend (frontend/.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_DEBUG=false              # Set true for console logging
```

## Project Structure

```
semantic-search-next/
├── docker-compose.yml           # PostgreSQL + ChromaDB + pgAdmin
├── docs/
│   ├── ARCHITECTURE.md          # Detailed system design
│   └── INFRASTRUCTURE.md        # Setup guide for all services
├── backend/
│   ├── .env.example             # Backend environment template
│   ├── app/
│   │   ├── main.py              # FastAPI entry
│   │   ├── config.py            # Settings
│   │   ├── api/v1/              # REST endpoints
│   │   │   ├── collections.py   # Collection CRUD
│   │   │   ├── documents.py     # Document upload/delete
│   │   │   ├── search.py        # Search with AI answers
│   │   │   ├── analytics.py     # Search analytics
│   │   │   ├── settings.py      # App settings
│   │   │   └── health.py        # Health check
│   │   ├── core/                # Business logic
│   │   │   ├── hybrid_retriever.py  # RRF fusion
│   │   │   ├── reranker.py      # Jina/Cohere reranking
│   │   │   ├── qa_chain.py      # RAG answer generation
│   │   │   ├── answer_verifier.py   # Citation verification
│   │   │   └── embeddings.py    # Multi-provider embeddings
│   │   ├── prompts/             # Externalized LLM prompts
│   │   │   ├── qa.yaml          # QA generation prompts
│   │   │   └── verification.yaml    # Verification prompts
│   │   ├── services/
│   │   │   └── retrieval.py     # HybridSearchService + BM25 cache
│   │   ├── db/
│   │   │   └── models.py        # SQLAlchemy models
│   │   └── api/
│   │       └── schemas.py       # Pydantic schemas
│   └── pyproject.toml
├── frontend/
│   ├── .env.example             # Frontend environment template
│   ├── src/
│   │   ├── app/                 # Next.js App Router
│   │   │   ├── page.tsx         # Main search page
│   │   │   ├── analytics/       # Search analytics dashboard
│   │   │   ├── documents/[id]/  # Document preview
│   │   │   ├── collections/     # Collection management
│   │   │   └── settings/        # Settings page
│   │   ├── components/
│   │   │   ├── ui/              # Shadcn components
│   │   │   ├── layout/          # Header, sidebar
│   │   │   ├── search/          # Search components
│   │   │   ├── analytics/       # Analytics charts
│   │   │   └── documents/       # Document viewer
│   │   ├── lib/
│   │   │   ├── api/             # API client & types
│   │   │   └── debug.ts         # Debug logging utility
│   │   └── hooks/               # TanStack Query hooks
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## API Endpoints

### Collections
```
POST   /api/v1/collections              Create collection
GET    /api/v1/collections              List collections
GET    /api/v1/collections/{id}         Get collection
PATCH  /api/v1/collections/{id}         Update collection
DELETE /api/v1/collections/{id}         Delete collection
```

### Documents
```
POST   /api/v1/collections/{id}/documents   Upload document (invalidates BM25 cache)
GET    /api/v1/collections/{id}/documents   List documents
GET    /api/v1/documents/{id}               Get document
DELETE /api/v1/documents/{id}               Delete document (invalidates BM25 cache)
```

### Search
```
POST   /api/v1/search                   Execute search with optional AI answer
```

**Request:**
```json
{
  "query": "machine learning",
  "preset": "balanced",
  "top_k": 10,
  "collection_id": "optional-uuid",
  "generate_answer": true
}
```

**Response:**
```json
{
  "query": "machine learning",
  "results": [...],
  "low_confidence_results": [...],
  "low_confidence_count": 3,
  "min_score_threshold": 0.30,
  "answer": "Machine learning is...",
  "answer_verification": {
    "confidence": "high",
    "citations": [...],
    "verified_claims": 3,
    "total_claims": 3,
    "coverage_percent": 100
  },
  "latency_ms": 245,
  "retrieval_method": "balanced"
}
```

### Analytics
```
GET    /api/v1/analytics/searches       Search history (paginated)
GET    /api/v1/analytics/stats          Aggregate statistics
GET    /api/v1/analytics/trends         Time-series data
```

### Settings
```
GET    /api/v1/settings                 Get current settings
PATCH  /api/v1/settings                 Update settings
POST   /api/v1/settings/reset           Reset to defaults
```

**Key Settings:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `default_preset` | string | `balanced` | Retrieval preset |
| `default_alpha` | float | 0.5 | Semantic vs BM25 weight |
| `default_use_reranker` | bool | true | Enable reranking |
| `default_top_k` | int | 10 | Results to return |
| `min_score_threshold` | float | 0.30 | Low-confidence cutoff |
| `default_generate_answer` | bool | false | Enable AI answer generation |
| `default_context_window` | int | 1 | Chunks before/after for context |
| `show_scores` | bool | true | Display score breakdown |

### Health
```
GET    /api/v1/health                   Health check
```

## Search Result Scores

Each result includes a `scores` object:

```json
{
  "scores": {
    "semantic_score": 0.85,    // Normalized 0-1 (cosine similarity)
    "bm25_score": 0.72,        // Normalized 0-1 (keyword match)
    "rerank_score": 0.92,      // Cross-encoder 0-1 (when enabled)
    "final_score": 0.92,       // Used for ranking/filtering
    "relevance_percent": 92    // Display value (0-100%)
  }
}
```

## Development

### Backend

```bash
cd backend
source .venv/bin/activate

# Lint
ruff check .

# Format
ruff format .

# Type check
mypy app

# Test
pytest
```

### Frontend

```bash
cd frontend

# Lint
npm run lint

# Format
npm run format

# Build
npm run build
```

## Test Queries

```bash
# High-confidence query
curl -s -X POST "http://localhost:8080/api/v1/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning", "preset": "balanced", "top_k": 5}'

# Low-confidence query (unrelated to docs)
curl -s -X POST "http://localhost:8080/api/v1/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "quantum entanglement physics", "preset": "balanced", "top_k": 10}'

# Check settings
curl -s http://localhost:8080/api/v1/settings

# Health check
curl -s http://localhost:8080/api/v1/health
```

## Retrieval Presets

| Preset | Alpha | Use Reranker | Description |
|--------|-------|--------------|-------------|
| `high_precision` | 0.8 | true | Emphasizes semantic similarity, best for specific queries |
| `balanced` | 0.5 | true | Equal weight to semantic and keyword, good default |
| `high_recall` | 0.3 | true | Emphasizes keyword matching, better for exploratory search |

## Known Considerations

- **BM25 Cache**: Automatically invalidated when documents are uploaded/deleted
- **Confidence Threshold**: Adjustable via Settings API (`min_score_threshold`)
- **Reranking**: Falls back to Jina local model if Cohere unavailable

## License

MIT License
