# Infrastructure Setup Guide

> Complete setup guide for all services, databases, and AI providers used by Semantic Search Next.

---

## Table of Contents

- [Overview](#overview)
- [Docker Services](#docker-services)
- [PostgreSQL Setup](#postgresql-setup)
- [ChromaDB Setup](#chromadb-setup)
- [AI Provider Setup](#ai-provider-setup)
  - [OpenAI (Cloud)](#openai-cloud)
  - [Ollama (Local)](#ollama-local)
  - [Anthropic (Cloud)](#anthropic-cloud)
  - [Jina AI](#jina-ai)
  - [Cohere](#cohere)
  - [Voyage AI](#voyage-ai)
- [Reranker Setup](#reranker-setup)
- [Troubleshooting](#troubleshooting)

---

## Overview

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            LOCAL MACHINE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐   │
│  │   Frontend   │    │   Backend    │    │     Docker Services      │   │
│  │  Next.js     │───▶│   FastAPI    │───▶│  ┌────────────────────┐  │   │
│  │  Port 3000   │    │  Port 8080   │    │  │    PostgreSQL      │  │   │
│  └──────────────┘    └──────┬───────┘    │  │    Port 5432       │  │   │
│                             │            │  └────────────────────┘  │   │
│                             │            │  ┌────────────────────┐  │   │
│                             │            │  │     pgAdmin        │  │   │
│                             │            │  │    Port 3001       │  │   │
│                             │            │  └────────────────────┘  │   │
│                             │            └──────────────────────────┘   │
│                             │                                            │
│                             │            ┌──────────────────────────┐   │
│                             └───────────▶│      ChromaDB            │   │
│                                          │      Port 8000           │   │
│                                          │   (Separate Container)   │   │
│                                          └──────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Optional: Local AI Services                    │   │
│  │  ┌────────────────┐    ┌─────────────────────────────────────┐   │   │
│  │  │    Ollama      │    │   Jina Reranker (auto-downloaded)   │   │   │
│  │  │  Port 11434    │    │         (runs in-process)           │   │   │
│  │  └────────────────┘    └─────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLOUD SERVICES (Optional)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │   OpenAI     │  │   Cohere     │  │   Jina AI    │  │  Voyage AI  │  │
│  │  Embeddings  │  │  Reranking   │  │  Embeddings  │  │  Embeddings │  │
│  │     LLM      │  │  Embeddings  │  │              │  │             │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Service Ports Summary

| Service | Port | Purpose |
|---------|------|---------|
| Frontend (Next.js) | 3000 | Web UI |
| Backend (FastAPI) | 8080 | REST API |
| PostgreSQL | 5432 | Metadata, settings, search history |
| ChromaDB | 8000 | Vector storage for semantic search |
| pgAdmin | 3001 | Database management UI |
| Ollama | 11434 | Local LLM/embeddings (optional) |

---

## Docker Services

### Starting All Services

```bash
# Start PostgreSQL + pgAdmin
docker-compose up -d

# Start ChromaDB (separate container)
docker run -d --name chromadb -p 8000:8000 chromadb/chroma
```

### Stopping Services

```bash
# Stop docker-compose services
docker-compose down

# Stop ChromaDB
docker stop chromadb
```

### Viewing Logs

```bash
# PostgreSQL logs
docker logs semantic-search-postgres

# ChromaDB logs
docker logs chromadb

# Follow logs in real-time
docker logs -f semantic-search-postgres
```

### Data Persistence

Data is persisted in Docker volumes:
- `postgres_data` - PostgreSQL database files
- `pgadmin_data` - pgAdmin configuration

```bash
# List volumes
docker volume ls

# Remove volumes (WARNING: deletes all data)
docker-compose down -v
docker volume rm chromadb_data  # if using named volume
```

---

## PostgreSQL Setup

### Via Docker (Recommended)

PostgreSQL runs via `docker-compose.yml` using the official `postgres:15-alpine` image.

```yaml
# docker-compose.yml excerpt
postgres:
  image: postgres:15-alpine
  ports:
    - "5432:5432"
  environment:
    POSTGRES_DB: semantic_search
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
```

### Connection Details

| Setting | Value |
|---------|-------|
| Host | `localhost` or `127.0.0.1` |
| Port | `5432` |
| Database | `semantic_search` |
| User | `postgres` |
| Password | `postgres` (change in production!) |

### Using pgAdmin

1. Open http://localhost:3001
2. Login: `admin@local.dev` / `admin`
3. Add server:
   - Host: `postgres` (Docker network) or `host.docker.internal` (from host)
   - Port: `5432`
   - Database: `semantic_search`
   - Username: `postgres`
   - Password: `postgres`

### Database Migrations

The backend uses SQLAlchemy with auto-migration on startup:

```bash
cd backend
source .venv/bin/activate

# Tables are created automatically when the app starts
uvicorn app.main:app --reload --port 8080
```

### Native PostgreSQL (Alternative)

If you prefer native PostgreSQL instead of Docker:

**macOS (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
createdb semantic_search
```

**Ubuntu/Debian:**
```bash
sudo apt install postgresql-15
sudo -u postgres createdb semantic_search
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

---

## ChromaDB Setup

ChromaDB is the vector database for semantic search. It runs as a separate Docker container.

### Starting ChromaDB

```bash
# Basic (ephemeral storage)
docker run -d --name chromadb -p 8000:8000 chromadb/chroma

# With persistent storage (recommended)
docker run -d --name chromadb \
  -p 8000:8000 \
  -v chromadb_data:/chroma/chroma \
  chromadb/chroma
```

### Verifying ChromaDB

```bash
# Check if running
curl http://localhost:8000/api/v1/heartbeat
# Expected: {"nanosecond heartbeat": ...}

# List collections
curl http://localhost:8000/api/v1/collections
```

### ChromaDB Configuration

Environment variables in `backend/.env`:

```env
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

### ChromaDB with Authentication (Production)

For production, enable authentication:

```bash
docker run -d --name chromadb \
  -p 8000:8000 \
  -e CHROMA_SERVER_AUTH_CREDENTIALS_PROVIDER=chromadb.auth.token.TokenConfigServerAuthCredentialsProvider \
  -e CHROMA_SERVER_AUTH_CREDENTIALS="your-secret-token" \
  -e CHROMA_SERVER_AUTH_TOKEN_TRANSPORT_HEADER="Authorization" \
  -v chromadb_data:/chroma/chroma \
  chromadb/chroma
```

### Official Documentation

- **ChromaDB Docs**: https://docs.trychroma.com/
- **Docker Hub**: https://hub.docker.com/r/chromadb/chroma
- **GitHub**: https://github.com/chroma-core/chroma

---

## AI Provider Setup

### OpenAI (Cloud)

**Best for**: Production use, highest quality embeddings and LLM responses.

#### Setup

1. Get API key from https://platform.openai.com/api-keys
2. Add to `backend/.env`:

```env
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-large
LLM_MODEL=gpt-4o-mini
```

#### Available Models

| Model | Dimensions | Use Case |
|-------|------------|----------|
| `text-embedding-3-large` | 3072 | Highest quality (default) |
| `text-embedding-3-small` | 1536 | Cost-effective |
| `text-embedding-ada-002` | 1536 | Legacy |

#### Pricing

- Embeddings: ~$0.13 per 1M tokens (text-embedding-3-large)
- LLM: ~$0.15/1M input, $0.60/1M output (gpt-4o-mini)

#### Documentation

- **API Docs**: https://platform.openai.com/docs/api-reference
- **Embeddings Guide**: https://platform.openai.com/docs/guides/embeddings
- **Models**: https://platform.openai.com/docs/models

---

### Ollama (Local)

**Best for**: Privacy-focused deployments, offline use, cost savings.

#### Installation

**macOS:**
```bash
# Install via Homebrew
brew install ollama

# Or download from website
# https://ollama.ai/download
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download from https://ollama.ai/download

#### Starting Ollama

```bash
# Start the Ollama server
ollama serve

# Server runs on http://localhost:11434
```

#### Pulling Models

```bash
# Embedding models
ollama pull nomic-embed-text      # 274MB, 768 dims
ollama pull mxbai-embed-large     # 670MB, 1024 dims
ollama pull all-minilm            # 46MB, 384 dims (lightweight)

# LLM models (for answer generation)
ollama pull llama3.2              # 2GB, good balance
ollama pull mistral               # 4GB, high quality
ollama pull phi3                  # 2GB, Microsoft's small model
```

#### Configuration

```env
# backend/.env
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text
```

#### Verifying Ollama

```bash
# Check server
curl http://localhost:11434/api/tags

# Test embedding
curl http://localhost:11434/api/embeddings \
  -d '{"model": "nomic-embed-text", "prompt": "Hello world"}'
```

#### Available Embedding Models

| Model | Size | Dimensions | Notes |
|-------|------|------------|-------|
| `nomic-embed-text` | 274MB | 768 | Best quality/size ratio |
| `mxbai-embed-large` | 670MB | 1024 | Higher quality |
| `all-minilm` | 46MB | 384 | Fastest, lowest resource |
| `snowflake-arctic-embed` | 335MB | 1024 | Good for long docs |

#### Documentation

- **Official Site**: https://ollama.ai/
- **Model Library**: https://ollama.ai/library
- **GitHub**: https://github.com/ollama/ollama
- **API Docs**: https://github.com/ollama/ollama/blob/main/docs/api.md

---

### Anthropic (Cloud)

**Best for**: High-quality answer generation and evaluation with Claude models.

#### Setup

1. Get API key from https://console.anthropic.com/
2. Add to `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

#### Available Models

| Model | Use Case |
|-------|----------|
| `claude-sonnet-4-20250514` | Answer generation, Evaluation (default) |
| `claude-3-5-haiku-20241022` | Fast, cost-effective |

#### Configuration in Settings

In the app's Settings page, select:
- **Answer Provider**: Anthropic
- **Answer Model**: claude-sonnet-4-20250514
- **Eval Judge Provider**: Anthropic (for LLM-as-Judge)

#### Documentation

- **Console**: https://console.anthropic.com/
- **API Docs**: https://docs.anthropic.com/
- **Models**: https://docs.anthropic.com/en/docs/about-claude/models

---

### Jina AI

**Best for**: Free tier (1M tokens/month), good embedding quality.

#### Setup

1. Get free API key from https://jina.ai/embeddings/
2. Add to `backend/.env`:

```env
JINA_API_KEY=jina_...
EMBEDDING_PROVIDER=jina
EMBEDDING_MODEL=jina-embeddings-v3
```

#### Available Models

| Model | Dimensions | Notes |
|-------|------------|-------|
| `jina-embeddings-v3` | 1024 | Latest, best quality |
| `jina-embeddings-v2-base-en` | 768 | English optimized |
| `jina-embeddings-v2-small-en` | 512 | Lightweight |

#### Free Tier

- 1 million tokens per month
- No credit card required
- Rate limit: 500 RPM

#### Documentation

- **Embeddings**: https://jina.ai/embeddings/
- **API Reference**: https://api.jina.ai/redoc
- **GitHub**: https://github.com/jina-ai/jina

---

### Cohere

**Best for**: Reranking (best quality), multilingual support.

#### Setup

1. Get API key from https://dashboard.cohere.com/api-keys
2. Add to `backend/.env`:

```env
COHERE_API_KEY=...
EMBEDDING_PROVIDER=cohere  # For embeddings
RERANKER_PROVIDER=cohere   # For reranking
```

#### Available Models

**Embeddings:**
| Model | Dimensions | Notes |
|-------|------------|-------|
| `embed-english-v3.0` | 1024 | English, highest quality |
| `embed-multilingual-v3.0` | 1024 | 100+ languages |
| `embed-english-light-v3.0` | 384 | Lightweight |

**Reranking:**
| Model | Notes |
|-------|-------|
| `rerank-english-v3.0` | English, highest quality |
| `rerank-multilingual-v3.0` | 100+ languages |

#### Free Tier

- 1,000 API calls per month (Trial)
- Rate limit: 10 calls/min

#### Documentation

- **Dashboard**: https://dashboard.cohere.com/
- **Embeddings**: https://docs.cohere.com/docs/embeddings
- **Rerank**: https://docs.cohere.com/docs/rerank
- **API Reference**: https://docs.cohere.com/reference/about

---

### Voyage AI

**Best for**: RAG-optimized embeddings, code search.

#### Setup

1. Get API key from https://dash.voyageai.com/
2. Add to `backend/.env`:

```env
VOYAGE_API_KEY=pa-...
EMBEDDING_PROVIDER=voyage
EMBEDDING_MODEL=voyage-large-2
```

#### Available Models

| Model | Dimensions | Notes |
|-------|------------|-------|
| `voyage-large-2` | 1536 | General purpose, high quality |
| `voyage-code-2` | 1536 | Optimized for code |
| `voyage-lite-02-instruct` | 1024 | Lightweight |

#### Free Tier

- 50 million tokens free
- Then pay-as-you-go

#### Documentation

- **Dashboard**: https://dash.voyageai.com/
- **Docs**: https://docs.voyageai.com/
- **API Reference**: https://docs.voyageai.com/reference/embeddings-api

---

## Reranker Setup

Reranking improves search quality by re-scoring results with a cross-encoder model.

### Jina Reranker (Local - Default)

The Jina reranker runs locally with no API key required. The model is automatically downloaded on first use.

```env
# backend/.env
RERANKER_PROVIDER=jina  # or "auto" (tries Jina first)
USE_RERANKING=true
```

**Model Details:**
- Model: `jinaai/jina-reranker-v1-tiny-en`
- Size: ~33MB (downloaded automatically)
- Runs in-process (no external service)
- No API costs

**First Run:**
```
# On first search with reranking, you'll see:
INFO: Downloading Jina reranker model...
INFO: Model downloaded successfully
```

### Cohere Reranker (Cloud)

Higher quality but requires API key and has usage costs.

```env
# backend/.env
RERANKER_PROVIDER=cohere
COHERE_API_KEY=...
USE_RERANKING=true
```

### Auto Mode

Automatically selects the best available reranker:

```env
RERANKER_PROVIDER=auto
# Priority: 1. Jina (local), 2. Cohere (if API key set)
```

---

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check if container is running
docker ps | grep postgres

# Check logs
docker logs semantic-search-postgres

# Test connection
psql -h localhost -U postgres -d semantic_search
```

### ChromaDB Connection Issues

```bash
# Check if container is running
docker ps | grep chromadb

# Test heartbeat
curl http://localhost:8000/api/v1/heartbeat

# Check logs
docker logs chromadb
```

### Ollama Not Responding

```bash
# Check if server is running
curl http://localhost:11434/api/tags

# Restart Ollama
pkill ollama
ollama serve
```

### Port Conflicts

```bash
# Check what's using a port
lsof -i :8000  # ChromaDB
lsof -i :5432  # PostgreSQL
lsof -i :8080  # Backend

# Kill process on port
kill -9 $(lsof -t -i:8000)
```

### Reset Everything

```bash
# Stop all services
docker-compose down -v
docker stop chromadb && docker rm chromadb

# Remove ChromaDB data
docker volume rm chromadb_data

# Restart fresh
docker-compose up -d
docker run -d --name chromadb -p 8000:8000 -v chromadb_data:/chroma/chroma chromadb/chroma
```

---

## Quick Reference

### Minimum Setup (OpenAI Only)

```bash
# 1. Start infrastructure
docker-compose up -d
docker run -d --name chromadb -p 8000:8000 chromadb/chroma

# 2. Configure backend
cd backend
cp .env.example .env
# Edit .env: Add OPENAI_API_KEY

# 3. Start backend
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8080

# 4. Start frontend
cd ../frontend
npm install
npm run dev
```

### Fully Local Setup (No Cloud APIs)

```bash
# 1. Start infrastructure
docker-compose up -d
docker run -d --name chromadb -p 8000:8000 chromadb/chroma

# 2. Start Ollama
ollama serve &
ollama pull nomic-embed-text
ollama pull llama3.2

# 3. Configure backend for local
cd backend
cp .env.example .env
# Edit .env:
#   EMBEDDING_PROVIDER=ollama
#   EMBEDDING_MODEL=nomic-embed-text
#   OLLAMA_BASE_URL=http://localhost:11434
#   RERANKER_PROVIDER=jina

# 4. Start services
source .venv/bin/activate
uvicorn app.main:app --reload --port 8080

cd ../frontend
npm run dev
```
