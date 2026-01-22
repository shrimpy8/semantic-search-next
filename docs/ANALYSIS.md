# Project Analysis: Search Quality, Code Quality, DRY, and Observability

This document summarizes findings from reviewing README and codebase, then proposes a safe, incremental action plan. The focus is on (1) search/RAG quality, (2) code quality, (3) DRY violations, and (4) error handling/observability. Recommendations are prioritized and include risks of not addressing.

## Findings (Prioritized)

### P0 — Correctness / Search Quality Risks

1) **BM25 ignores `document_ids` scoping in hybrid search**
- **Where**: `backend/app/services/retrieval.py`
- **What**: BM25 index is built only by `collection_id` (or global). `document_ids` are applied only to semantic retriever. Hybrid mode can return BM25 hits from documents outside the requested `document_ids`.
- **Risk if not addressed**: Results violate API contract, return out‑of‑scope content, and undermine trust; evaluation data becomes invalid.
- **Why fix**: Correctness + user trust; scoped searches must stay scoped.

2) **Reranker‑off path makes almost everything “low confidence”**
- **Where**: `backend/app/api/v1/search.py`, `backend/app/core/hybrid_retriever.py`
- **What**: When reranking is disabled/unavailable, `final_score` is RRF (tiny values). With `min_score_threshold` default `0.35`, nearly all results fall into low‑confidence.
- **Risk if not addressed**: Users see empty “high confidence” results, RAG answer often skipped → looks broken.
- **Why fix**: Preserve usability in setups without reranker (common in local dev).

3) **Hybrid de‑duplication can merge distinct chunks**
- **Where**: `backend/app/core/hybrid_retriever.py`
- **What**: `_get_doc_id()` hashes chunk text only. Identical text across different docs collapses into one result.
- **Risk if not addressed**: Missing results, incorrect citations, and wrong provenance.
- **Why fix**: Retrieval correctness and trustworthy citations.

4) **Embedding model changes can silently degrade search**
- **Where**: `backend/app/services/retrieval.py`
- **What**: Embedding model is loaded once at startup; settings allow changing embedding model without re‑indexing or restart.
- **Risk if not addressed**: Dimension mismatch errors, degraded recall, or silent failures.
- **Why fix**: Avoid silent regressions and confusing settings behavior.

---

### P1 — RAG Quality & Best Practices

5) **Semantic scores are rank‑based, not similarity‑based**
- **Where**: `backend/app/core/hybrid_retriever.py`
- **What**: Uses `1/(rank)` instead of vector similarity.
- **Risk if not addressed**: Confidence thresholds and analytics are poorly calibrated; harder to tune ranking.
- **Why fix**: More meaningful scoring and more stable evaluation.

6) **RAG context limited to top 3 chunks, ignores adjacent context**
- **Where**: `backend/app/api/v1/search.py`
- **What**: Context uses only top 3 high‑confidence chunks and does not incorporate `context_before/after`.
- **Risk if not addressed**: Lower answer completeness and faithfulness for multi‑chunk answers.
- **Why fix**: Better factuality and user satisfaction.

7) **No OCR fallback for scanned PDFs**
- **Where**: `backend/app/api/v1/documents.py`
- **What**: Uses `PyPDFLoader` only; scanned PDFs will yield empty text.
- **Risk if not addressed**: “Empty document” errors or poor recall from common doc types.
- **Why fix**: Improves ingestion robustness.

8) **Chunk metadata inconsistencies (`total_chunks` missing)**
- **Where**: `backend/app/api/v1/documents.py` vs `backend/app/core/document_processor.py`
- **What**: In ingestion path, `chunk_index` is set but `total_chunks` is not.
- **Risk if not addressed**: UI/context expansion behavior is inconsistent.
- **Why fix**: Reliable navigation and context building.

---

### P1 — Code Quality / Maintainability

9) **Legacy JSON storage managers appear unused and diverge from DB logic**
- **Where**: `backend/app/core/document_manager.py`, `collection_manager.py`, `search_manager.py`, `storage.py`, `conversation.py`
- **What**: These are not referenced by API routes and are out of sync with SQLAlchemy model behavior.
- **Risk if not addressed**: Confusion for maintainers, accidental reuse, drift in logic.
- **Why fix**: Reduce cognitive load and prevent accidental regressions.

10) **Document ingestion logic duplicated and inconsistent**
- **Where**: `backend/app/api/v1/documents.py` vs `backend/app/core/document_processor.py`
- **What**: Two ingestion implementations; metadata and chunking differ.
- **Risk if not addressed**: Subtle bugs and inconsistent behavior.
- **Why fix**: Single source of truth for chunking.

11) **`answer_style` is not updateable via settings**
- **Where**: `backend/app/db/repositories/settings_repo.py`
- **What**: `SettingsUpdate` supports `answer_style`, but repo update ignores it.
- **Risk if not addressed**: Settings UI appears to update but does nothing.
- **Why fix**: Correctness and user trust.

12) **Settings defaults mismatch**
- **Where**: `backend/app/db/models.py` and `backend/app/db/repositories/settings_repo.py`
- **What**: `min_score_threshold` default is `0.35`, but reset uses `0.3`.
- **Risk if not addressed**: Non‑deterministic behavior after reset.
- **Why fix**: Predictable behavior.

---

### P2 — Error Handling / Tracing / Debugging

13) **Request ID not propagated to deeper logs**
- **Where**: `backend/app/api/middleware.py` + core services
- **What**: Request ID is generated but not attached to structured logs or context.
- **Risk if not addressed**: Hard to trace multi‑step failures.
- **Why fix**: Faster debugging and better support.

14) **In‑memory rate limiting is not production‑safe**
- **Where**: `backend/app/api/middleware.py`
- **What**: Per‑process memory; no cross‑instance consistency.
- **Risk if not addressed**: Ineffective in multi‑worker deployments.
- **Why fix**: Prevent abuse and runaway costs.

15) **Context expansion is potentially expensive per result**
- **Where**: `backend/app/api/v1/search.py`, `backend/app/core/vector_store.py`
- **What**: Adjacent chunk fetch loads all chunks per document for each result.
- **Risk if not addressed**: Latency spikes for large docs.
- **Why fix**: Performance and responsiveness.

---

## Action Plan (Small, Safe Refactors — No Behavior Break)

This plan focuses on incremental changes with minimal risk. Each step is isolated and reversible.

### Phase 1 — Correctness Safeguards (P0)

1) **Fix `document_ids` scoping for BM25 in hybrid search**
- Approach: Post‑filter BM25 results by document ID when `document_ids` present. (Low risk; does not affect default behavior when `document_ids` absent.)
- Files: `backend/app/services/retrieval.py`, optionally add helper in `backend/app/core/hybrid_retriever.py`.

2) **Normalize confidence thresholds when reranker is off**
- Approach: If reranker unavailable/disabled, apply a separate threshold or scale RRF scores before filtering.
- Files: `backend/app/api/v1/search.py`, `backend/app/core/hybrid_retriever.py`.

3) **Dedup by stable document identifier**
- Approach: Use `document_id + chunk_index` (from metadata) as key, fall back to content hash if missing.
- Files: `backend/app/core/hybrid_retriever.py`.

4) **Guard embedding model changes**
- Approach: In settings update, warn or block embedding model change unless reindex flag or admin action is provided.
- Files: `backend/app/db/repositories/settings_repo.py`, `backend/app/api/v1/settings.py`.

### Phase 2 — Quality & Consistency (P1)

5) **Use similarity scores (not rank‑only) for semantic retrieval**
- Approach: Switch to vector store APIs that return scores; update normalization accordingly.
- Files: `backend/app/core/vector_store.py`, `backend/app/core/hybrid_retriever.py`.

6) **Improve RAG context building**
- Approach: Add a context builder that merges top N chunks plus adjacent context, with token/length budget.
- Files: `backend/app/api/v1/search.py`.

7) **Unify ingestion logic**
- Approach: Refactor `process_and_index_document` to use `DocumentProcessor` or move chunking into a shared utility.
- Files: `backend/app/api/v1/documents.py`, `backend/app/core/document_processor.py`.

8) **Fix `answer_style` updates and settings defaults mismatch**
- Approach: Add `answer_style` to allowed fields; align defaults in model and reset.
- Files: `backend/app/db/repositories/settings_repo.py`, `backend/app/db/models.py`.

### Phase 3 — Observability & Performance (P2)

9) **Propagate request ID into logs**
- Approach: Use a contextvar or log filter to inject `request_id` across logs.
- Files: `backend/app/api/middleware.py`, logging config in `backend/app/main.py`.

10) **Optimize adjacent chunk retrieval**
- Approach: Cache chunks per document per request, or batch fetch once per document.
- Files: `backend/app/api/v1/search.py`, `backend/app/core/vector_store.py`.

11) **Rate limiting for production**
- Approach: Add optional Redis limiter, keep in‑memory limiter for local dev.
- Files: `backend/app/api/middleware.py`.

---

## Notes on Risk and Safe Execution

- Phase 1 changes are scoped and safe: they change filtering or keying logic with minimal impact to default behavior.
- Phase 2 changes improve quality and consistency; require careful validation but can be staged behind feature flags if desired.
- Phase 3 changes are operational improvements and can be rolled out independently.

---

## Suggested Next Steps

1) Implement Phase 1 fixes (scoping, confidence threshold logic, dedup key). 
2) Add tests for scoped search (document_ids) and reranker‑off thresholds. 
3) Plan Phase 2 quality improvements with eval baselines (use existing eval framework).

