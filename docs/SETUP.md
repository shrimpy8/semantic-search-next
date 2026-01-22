# Setup Guide (Semantic Search Next)

This guide consolidates the minimum steps to run the full app locally (backend + frontend + Postgres + ChromaDB), plus optional local AI.

## Requirements
- Node.js 18+
- Python 3.11+
- Docker + Docker Compose

## Quick Start (Recommended)

### 1) Configure env files
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```
Edit `backend/.env` with your API keys if using cloud providers.

### 2) Start data services
```bash
# Postgres + pgAdmin
cd /Users/harshh/Documents/GitHub/semantic-search-next
docker-compose up -d

# ChromaDB (separate container)
docker run -d --name chromadb -p 8000:8000 chromadb/chroma
```

Ports:
- Postgres: `localhost:5432`
- ChromaDB: `localhost:8000`
- pgAdmin: `http://localhost:3001`

### 3) Start backend
```bash
cd /Users/harshh/Documents/GitHub/semantic-search-next/backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8080
```

### 4) Start frontend
```bash
cd /Users/harshh/Documents/GitHub/semantic-search-next/frontend
npm install
npm run dev
```

Open:
- UI: `http://localhost:3000`
- API: `http://localhost:8080`
- API docs: `http://localhost:8080/docs`

### 5) Verify health
```bash
curl http://localhost:8080/api/v1/health/ready
```
Expected `services: { api: healthy, database: healthy, chromadb: healthy }`.

---

## Local PostgreSQL (Alternative to Docker)
If you prefer a native install instead of Docker:

**macOS (Homebrew)**
```bash
brew install postgresql@15
brew services start postgresql@15
createdb semantic_search
```

**Ubuntu/Debian**
```bash
sudo apt install postgresql-15
sudo -u postgres createdb semantic_search
```

Then ensure `backend/.env` points to `POSTGRES_HOST=localhost` and `POSTGRES_PORT=5432`.

---

## Optional: Local AI with Ollama
You can run embeddings + LLM locally (no API keys required).

```bash
# Install
brew install ollama

# Start service
ollama serve

# Pull models (example)
ollama pull nomic-embed-text-v2-moe
ollama pull llama3.2
```

In the app settings page (`/settings`):
- Embedding model: `ollama:nomic-embed-text-v2-moe:latest`
- Answer provider: `ollama` → model `llama3.2`
- Eval provider: `ollama` → model `llama3.1` or `llama3.2`

---

## Common Issues

### Missing or invalid API keys
- **OpenAI**: set `OPENAI_API_KEY` in `backend/.env`  
- **Anthropic**: set `ANTHROPIC_API_KEY` in `backend/.env`  
- **Cohere** (reranker/embeddings): set `COHERE_API_KEY` in `backend/.env`  
- **Jina** (embeddings): set `JINA_API_KEY` in `backend/.env`  
- **Voyage** (embeddings): set `VOYAGE_API_KEY` in `backend/.env`  

Then restart the backend so `app/config.py` re-reads env vars.  
You can validate provider availability in the UI at `/settings`, or via API:

```
http://localhost:8080/api/v1/settings/providers
http://localhost:8080/api/v1/settings/llm-models
http://localhost:8080/api/v1/settings/embedding-providers
```
### Backend can’t connect to Postgres
- Ensure `semantic-search-postgres` is running (Docker) or local Postgres is running.
- Check `backend/.env`:
  - `POSTGRES_HOST=localhost`
  - `POSTGRES_PORT=5432`

### Backend can’t connect to ChromaDB
- Ensure the `chroma` container is running on port `8000`.
- Verify: `curl http://localhost:8000/api/v1/heartbeat`

### Frontend can’t reach backend
- Check `frontend/.env.local`:
  - `NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1`

---

## Helpful Commands

```bash
# Stop containers
cd /Users/harshh/Documents/GitHub/semantic-search-next
docker-compose down

docker stop chromadb

# Logs
docker logs semantic-search-postgres

docker logs chromadb
```
