# Setup Guide

Step-by-step guide to get a working local setup of Semantic Search Next.

## Default Configuration

This setup uses:
- **Embeddings**: OpenAI `text-embedding-3-large`
- **Answer Generation**: Anthropic Claude `claude-sonnet-4-20250514`
- **Evaluation Judge**: Anthropic Claude `claude-sonnet-4-20250514`
- **Reranker**: Jina (local, no API key needed)
- **Database**: PostgreSQL (Docker)
- **Vector Store**: ChromaDB (Docker)

## Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **Python 3.11+** - [Download](https://www.python.org/downloads/)
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)

## Step 1: Clone Repository

```bash
git clone https://github.com/shrimpy8/semantic-search-next.git
cd semantic-search-next
```

## Step 2: Start PostgreSQL

```bash
# Start PostgreSQL container
docker-compose up -d

# Verify it's running
docker ps | grep postgres
# Should show: semantic-search-postgres ... Up ... 0.0.0.0:5432->5432/tcp
```

Connection details:
- Host: `localhost`
- Port: `5432`
- Database: `semantic_search`
- User: `postgres`
- Password: `postgres`

## Step 3: Start ChromaDB

```bash
# Start ChromaDB container
docker run -d --name chromadb -p 8000:8000 chromadb/chroma

# Verify it's running
curl http://localhost:8000/api/v1/heartbeat
# Should return: {"nanosecond heartbeat": ...}
```

## Step 4: Configure Backend

```bash
cd backend

# Copy environment template
cp .env.example .env
```

Edit `backend/.env` and add your API keys:

```env
# Required for embeddings
OPENAI_API_KEY=sk-...

# Required for answer generation and evaluation
ANTHROPIC_API_KEY=sk-ant-...
```

## Step 5: Start Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate   # Windows

# Install dependencies
pip install -e ".[dev]"

# Start server
uvicorn app.main:app --reload --port 8080
```

Verify backend is running:
```bash
curl http://localhost:8080/api/v1/health
# Should return: {"status":"healthy",...}
```

## Step 6: Configure Frontend

```bash
cd frontend

# Copy environment template
cp .env.example .env.local
```

The default `frontend/.env.local` should contain:
```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
```

## Step 7: Start Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## Step 8: Open the App

Open http://localhost:3000 in your browser.

## Step 9: Configure AI Providers (First Time)

1. Go to **Settings** (`/settings`)
2. Set **Answer Provider** to `anthropic` and model to `claude-sonnet-4-20250514`
3. Set **Eval Judge Provider** to `anthropic` and model to `claude-sonnet-4-20250514`
4. Click **Save Settings**

## Security Features (Enabled by Default)

Input sanitization, injection detection, and trust boundaries are enabled out of the box. No configuration needed. To customize:

- **Disable sanitization**: Set `ENABLE_INPUT_SANITIZATION=false` in `backend/.env`
- **Disable detection**: Set `ENABLE_INJECTION_DETECTION=false` in `backend/.env`
- **Trust boundaries**: Mark collections as trusted/unverified in the collection edit dialog

See [INFRASTRUCTURE.md](INFRASTRUCTURE.md#security-configuration) for full details.

## Verify Everything Works

1. Go to **Collections** and create a new collection
2. Upload a document (PDF, TXT, or MD)
3. Go to **Search** and run a query
4. Enable "Generate AI Answer" to test answer generation

---

## Quick Reference

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | Web UI |
| Backend | http://localhost:8080 | REST API |
| API Docs | http://localhost:8080/api/v1/docs | Swagger UI |
| PostgreSQL | localhost:5432 | Metadata storage |
| ChromaDB | localhost:8000 | Vector storage |
| pgAdmin | http://localhost:3001 | DB admin (optional) |

## Common Issues

### "Connection refused" to PostgreSQL
```bash
# Check if container is running
docker ps | grep postgres

# If not running, start it
docker-compose up -d
```

### "Connection refused" to ChromaDB
```bash
# Check if container is running
docker ps | grep chroma

# If not running, start it
docker run -d --name chromadb -p 8000:8000 chromadb/chroma
```

### Backend can't find API keys
- Ensure `backend/.env` file exists and has correct keys
- Restart the backend after editing `.env`

### Frontend can't reach backend
- Verify backend is running on port 8080
- Check `frontend/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1`

## Stop Services

```bash
# Stop frontend: Ctrl+C in terminal

# Stop backend: Ctrl+C in terminal

# Stop Docker services
docker-compose down
docker stop chromadb
```

## Start Services (After Initial Setup)

```bash
# 1. Start Docker services
docker-compose up -d
docker start chromadb

# 2. Start backend
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --port 8080

# 3. Start frontend (new terminal)
cd frontend && npm run dev
```
