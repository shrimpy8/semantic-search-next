# Semantic Search API

FastAPI backend for the Semantic Search application.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --port 8080
```

## API Docs

- Swagger UI: http://localhost:8080/api/v1/docs
- ReDoc: http://localhost:8080/api/v1/redoc
