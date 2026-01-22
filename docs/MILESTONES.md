# Milestones — Semantic Search Next

Status key: [ ] pending, [~] in progress, [x] completed

## Phase 1 — Correctness Safeguards (P0)
- [x] Fix BM25 `document_ids` scoping in hybrid search
- [x] Normalize confidence thresholds when reranker is off/unavailable
- [x] Deduplicate hybrid results by stable chunk identifier
- [x] Guard embedding model changes to prevent silent degradation

## Phase 2 — Quality & Consistency (P1)
- [x] Use similarity scores for semantic retrieval (not rank-only)
- [x] Improve RAG context building with adjacent chunks + budget
- [x] Unify ingestion logic (single chunking pipeline)
- [x] Enable `answer_style` updates and align settings defaults
- [ ] Fix backend lint/type issues uncovered by ruff/mypy

## Phase 3 — Observability & Performance (P2)
- [x] Propagate request ID into logs across services
- [x] Optimize adjacent chunk retrieval (cache per request)
- [ ] Optional: add production-grade rate limiting (Redis)

## Environment Checks
- [x] Docker services checked (Postgres + Chroma running)
- [x] Ollama models listed
