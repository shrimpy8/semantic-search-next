# Configuration Strategy

> **Purpose**: Define the separation between `.env` configuration and DB Settings for all configurable options.
> **Status**: **IMPLEMENTED** - December 2024

---

## Overview

The application uses a **two-tier configuration system**:

| Tier | Source | When to Use | Who Changes It |
|------|--------|-------------|----------------|
| **Infrastructure** | `.env` file | Server startup, credentials, infrastructure URLs | DevOps / Administrator |
| **Application** | DB Settings (singleton) | Runtime behavior, user preferences, model choices | End Users via Settings Page |

**Core Principle**: Settings that users might want to change during normal operation are in DB Settings. Settings that require deployment/restart are in `.env`.

---

## Current Implementation

### Infrastructure Settings (`.env`)

These settings **MUST** stay in `.env` because they are secrets or deployment-specific:

```env
# API Keys - Secrets, never expose in UI
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
COHERE_API_KEY=...
JINA_API_KEY=...
VOYAGE_API_KEY=...

# Infrastructure URLs - Deployment specific
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=semantic_search
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

CHROMA_HOST=localhost
CHROMA_PORT=8000

OLLAMA_BASE_URL=http://localhost:11434

# API Server Config
API_HOST=0.0.0.0
API_PORT=8080
API_PREFIX=/api/v1
DEBUG=false

# Operational Timeouts (advanced)
EVAL_TIMEOUT_SECONDS=30
EVAL_RETRY_COUNT=2
EVAL_RETRY_DELAY_MS=1000
```

### User Settings (DB Settings Table)

These settings are configurable via the Settings page UI:

```python
# Embeddings - Provider encoded in model string
embedding_model: str = "openai:text-embedding-3-large"  # Format: "provider:model"

# AI Answer Generation
answer_provider: str = "openai"       # openai, anthropic, ollama
answer_model: str = "gpt-4o-mini"
answer_style: str = "detailed"        # concise, detailed, technical, conversational

# Evaluation Judge
eval_judge_provider: str = "openai"   # openai, anthropic, ollama
eval_judge_model: str = "gpt-4o-mini"

# Reranking
reranker_provider: str = "auto"       # auto, jina, cohere, none

# Document Processing
chunk_size: int = 1000
chunk_overlap: int = 200

# Search Defaults
default_alpha: float = 0.5
default_use_reranker: bool = True
default_preset: str = "balanced"
default_top_k: int = 5
min_score_threshold: float = 0.35
context_window_size: int = 1

# Answer Generation
default_generate_answer: bool = False

# Display
show_scores: bool = True
results_per_page: int = 10
```

---

## Provider Configuration

### Embedding Providers

| Provider | Model String Format | Available Models |
|----------|---------------------|------------------|
| OpenAI | `openai:text-embedding-3-large` | text-embedding-3-large, text-embedding-3-small, text-embedding-ada-002 |
| Ollama | `ollama:nomic-embed-text` | nomic-embed-text, mxbai-embed-large |
| Jina | `jina:jina-embeddings-v3` | jina-embeddings-v2-base-en, jina-embeddings-v3 |
| Voyage | `voyage:voyage-large-2` | voyage-large-2, voyage-2 |
| Cohere | `cohere:embed-english-v3.0` | embed-english-v3.0, embed-multilingual-v3.0 |

**Note**: Embedding provider is extracted from the model string (e.g., `"ollama:nomic-embed-text"` → provider is `"ollama"`).

### Answer Providers

| Provider | Available Models | Recommended |
|----------|------------------|-------------|
| OpenAI | gpt-4o-mini, gpt-4o, gpt-4-turbo | gpt-4o-mini |
| Anthropic | claude-sonnet-4-20250514, claude-opus-4-20250514 | claude-sonnet-4-20250514 |
| Ollama | llama3.2, llama3.1:8b, mistral | llama3.2 |

### Evaluation Providers

| Provider | Available Models | Recommended |
|----------|------------------|-------------|
| OpenAI | gpt-4o-mini, gpt-4o | gpt-4o-mini |
| Anthropic | claude-sonnet-4-20250514, claude-opus-4-20250514 | claude-sonnet-4-20250514 |
| Ollama | llama3.2, llama3.1:8b, mistral | llama3.1:8b |

### Reranker Providers

| Provider | Model | Notes |
|----------|-------|-------|
| auto | Automatic selection | Uses Jina (local) first, falls back to Cohere if available |
| jina | jina-reranker-v2-base-multilingual | Local, no API key needed |
| cohere | rerank-english-v3.0 | Cloud, requires COHERE_API_KEY |
| none | Disabled | No reranking |

---

## Settings Page UI Structure

The Settings page is organized into logical sections:

```
Settings Page
├── Search Defaults
│   ├── Default Preset (balanced/high_precision/high_recall)
│   ├── Default Results Count (top_k)
│   ├── Semantic/Keyword Balance (alpha slider)
│   ├── Use Reranker (toggle)
│   └── Min Score Threshold (slider)
│
├── AI Providers
│   ├── Embeddings
│   │   └── Model (dropdown with provider:model format)
│   ├── Answer Generation
│   │   ├── Provider (dropdown)
│   │   ├── Model (dropdown, filtered by provider)
│   │   ├── Style (dropdown: concise/detailed/technical/conversational)
│   │   └── Enable by Default (toggle)
│   ├── Evaluation Judge
│   │   ├── Provider (dropdown)
│   │   └── Model (dropdown, filtered by provider)
│   └── Reranker
│       └── Provider (dropdown: auto/jina/cohere/none)
│
├── Document Processing
│   ├── Chunk Size (input)
│   └── Chunk Overlap (input)
│
└── Display
    ├── Show Score Details (toggle)
    └── Results Per Page (input)
```

---

## Validation System

The `/settings/validate` endpoint performs comprehensive cross-validation:

### Checks Performed

1. **Database Connection**: PostgreSQL connectivity
2. **ChromaDB Connection**: Vector store availability
3. **Provider ↔ API Key Validation**:
   - Answer provider requires corresponding API key (except Ollama)
   - Eval provider requires corresponding API key (except Ollama)
   - Embedding provider requires corresponding API key (except Ollama)
4. **Reranker Validation**: Cohere reranker requires COHERE_API_KEY

### Example Validation Response

```json
{
  "ready": false,
  "summary": "2 of 6 checks failed",
  "checks": [
    {
      "name": "Database Connection",
      "status": "ok",
      "message": "PostgreSQL connection successful",
      "required": true
    },
    {
      "name": "Answer Provider Configuration",
      "status": "error",
      "message": "Answer provider set to 'anthropic' but ANTHROPIC_API_KEY is missing",
      "required": false
    }
  ]
}
```

---

## API Endpoints

### Settings Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/settings` | Get current settings |
| `PATCH` | `/settings` | Update settings |
| `GET` | `/settings/validate` | Validate configuration |
| `GET` | `/settings/embedding-providers` | Get available embedding providers |
| `GET` | `/settings/llm-models` | Get available LLM models by provider |

### LLM Models Response Structure

```json
{
  "answer_providers": {
    "openai": {
      "available": true,
      "models": [
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "description": "Fast, cost-effective"},
        {"id": "gpt-4o", "name": "GPT-4o", "description": "Most capable"}
      ],
      "default": "gpt-4o-mini"
    },
    "anthropic": {
      "available": false,
      "models": [...],
      "default": "claude-sonnet-4-20250514",
      "note": "ANTHROPIC_API_KEY not configured"
    },
    "ollama": {
      "available": true,
      "models": [...],
      "default": "llama3.2",
      "note": "Local inference, no API key needed"
    }
  },
  "eval_providers": {...},
  "recommended": {
    "answer": {"provider": "openai", "model": "gpt-4o-mini"},
    "eval": {"provider": "openai", "model": "gpt-4o-mini"}
  }
}
```

---

## Provider Availability Detection

Providers are automatically detected based on API key presence:

```python
# In config.py
def is_openai_available(self) -> bool:
    return bool(self.openai_api_key)

def is_anthropic_available(self) -> bool:
    return bool(self.anthropic_api_key)

def is_ollama_available(self) -> bool:
    return True  # Ollama is always "available" (checked at runtime)
```

The Settings page shows availability indicators:
- Available providers have a checkmark
- Unavailable providers show "API key not configured"
- Ollama shows "Local inference" note

---

## Migration Notes

### Changing Embedding Model

Changing the embedding model requires re-indexing all documents because:
1. Different models produce different vector dimensions
2. Vectors from different models are not comparable

**Process**:
1. Change embedding model in Settings
2. Delete and re-upload all documents
3. Or create a new collection with the new model

### Changing Answer/Eval Provider

These can be changed at any time without migration:
1. Update provider in Settings
2. Changes take effect immediately for new requests
3. No data migration required

---

## Summary

| Category | Location | Notes |
|----------|----------|-------|
| **API Keys** | `.env` | OPENAI_API_KEY, ANTHROPIC_API_KEY, COHERE_API_KEY, etc. |
| **Infrastructure** | `.env` | Database URLs, server ports, Ollama URL |
| **Embeddings** | DB Settings | `embedding_model` includes provider prefix |
| **AI Answers** | DB Settings | `answer_provider` + `answer_model` + `answer_style` |
| **Eval Judge** | DB Settings | `eval_judge_provider` + `eval_judge_model` |
| **Reranking** | DB Settings | `reranker_provider` only (model is fixed per provider) |
| **Search Defaults** | DB Settings | All search parameters |
| **Document Processing** | DB Settings | Chunk size/overlap |
| **Display** | DB Settings | UI preferences |

---

*Document Updated: December 2024*
*Status: Configuration hierarchy fully implemented*
