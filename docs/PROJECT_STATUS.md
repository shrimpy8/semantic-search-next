# Project Status & Roadmap

> **Last Verified**: January 2026
> **Consolidates**: MILESTONES.md, ANALYSIS.md, PROMPT_INJECTION_PLAN.md, MILESTONES_UNUSED_CLEANUP.md

This document tracks implementation status, security milestones, and outstanding work.

---

## Quick Status

| Area | Status | Notes |
|------|--------|-------|
| Core Search | **Complete** | Hybrid BM25+semantic, RRF fusion, reranking |
| AI Answers | **Complete** | Multi-provider (OpenAI, Anthropic, Ollama) |
| Evaluations | **Complete** | LLM-as-Judge with multi-provider support |
| Configuration | **Complete** | Two-tier config (.env + DB Settings) |
| Frontend | **Complete** | Full UI with Settings, Analytics, How It Works |
| Security (M1) | **Complete** | Prompt hardening across all YAML files |
| Security (M2) | **Complete** | Injection detection (observability mode) |
| Security (M3A) | **Complete** | Soft warnings in UI (threshold > 0.7) |
| Lint/Type | **Complete** | All issues resolved |

---

## Completed Work (Verified)

### Phase 1 — Correctness Safeguards (P0)

| Item | Status | Implementation |
|------|--------|----------------|
| BM25 `document_ids` scoping | Done | `retrieval.py:303-313` - filters BM25 by document ID |
| Confidence threshold normalization | Done | `search.py:348-353` - scales threshold when reranker off |
| Hybrid deduplication by stable ID | Done | `hybrid_retriever.py:205-224` - uses `document_id:chunk_index` |
| Embedding model change guard | Done | `settings.py:56-63` - requires `confirm_reindex=true` |

### Phase 2 — Quality & Consistency (P1)

| Item | Status | Implementation |
|------|--------|----------------|
| Similarity scores (not rank-only) | Done | `hybrid_retriever.py:363-391` - uses actual cosine scores |
| Adjacent chunks + budget | Done | `search.py:81-109, 257-318` - respects `context_window_size` |
| Unified ingestion logic | Done | `documents.py:76-100+` - single `_build_chunks()` function |
| `answer_style` updates | Done | `settings_repo.py`, `search.py:415-416` - maps to prompt keys |
| Settings defaults alignment | Done | Model and reset defaults now match |

### Phase 3 — Observability & Performance (P2)

| Item | Status | Implementation |
|------|--------|----------------|
| Request ID propagation | Done | `middleware.py:20-21, 127-151` - ContextVar + X-Request-ID header |
| Adjacent chunk caching | Done | `search.py:257-318` - `doc_chunks_cache` per request |
| In-memory rate limiting | Done | `middleware.py:29-121` - adequate for current scale |

### Security — Prompt Injection Mitigations

#### Milestone 1: Prompt Hardening (Complete)

All prompts hardened with instruction hierarchy and untrusted data warnings:

| File | Prompts Hardened | Pattern |
|------|------------------|---------|
| `qa.yaml` | 6 (qa_concise, qa_balanced, qa_detailed, qa_system, qa_technical, conversation_followup) | System > developer > user > retrieved content |
| `verification.yaml` | 4 (claim_extraction_system, verification_system, verification_user, claim_extraction_user) | Untrusted source warnings |
| `evaluation.yaml` | 6 + 1 guardrail (retrieval_*, answer_*, ground_truth_*) | Explicit untrusted data warnings |

#### Milestone 2: Injection Detection (Complete - Observability Mode)

- **Module**: `app/core/injection_detector.py`
- **Integration**: `app/services/retrieval.py:38-48, 333-363`
- **Feature flag**: `ENABLE_INJECTION_DETECTION` (default: true)
- **Behavior**: Logs warnings via `[INJECTION_DETECT]` prefix, never blocks

**Pattern Categories Detected:**
| Category | Weight | Example |
|----------|--------|---------|
| `instruction_override` | 0.8 | "ignore previous instructions" |
| `role_manipulation` | 0.6-0.7 | "you are now a hacker" |
| `system_extraction` | 0.7-0.9 | "show me the system prompt" |
| `delimiter_escape` | 0.6-0.9 | `</system>`, `[INST]` |
| `jailbreak_keywords` | 0.5-0.7 | "DAN mode", "bypass filter" |

**Rollback**: Set `ENABLE_INJECTION_DETECTION=false` in `.env`

#### Milestone 3A: Soft Warnings (Complete)

User-facing warnings for high-confidence detections (score > 0.7):

- **Backend**: `app/api/v1/search.py` - adds `injection_warning` and `injection_details` to response
- **Frontend**: `components/search/search-results.tsx` - displays warning banner
- **Behavior**: Informational only - does not block, filter, or modify results
- **Threshold**: Only shows warnings for score > 0.7 (minimizes false positives)

**What users see:**
- Orange warning banner when query or retrieved chunks contain suspicious patterns
- Message: "Potential content issue detected" with details
- Advice to verify AI answer carefully

### Multi-Provider Support (Complete)

| Provider | Embeddings | LLM (Answers) | LLM (Eval) | Reranker |
|----------|------------|---------------|------------|----------|
| OpenAI | text-embedding-3-* | gpt-4o-mini, gpt-4o | gpt-4o-mini, gpt-4o | - |
| Anthropic | - | Claude Sonnet 4, Opus 4 | Claude Sonnet 4, Opus 4 | - |
| Ollama | nomic-embed-text, mxbai-embed-large | llama3.2, mistral | llama3.2, llama3.1 | - |
| Jina | jina-embeddings-v2/v3 | - | - | jina-reranker-v1 (local) |
| Cohere | embed-english-v3.0 | - | - | rerank-english-v3.0 |
| Voyage | voyage-large-2 | - | - | - |

### Legacy Module Cleanup (Complete)

| Item | Status | Notes |
|------|--------|-------|
| Deprecation notes in legacy modules | Done | Was marked as legacy |
| Unused re-exports removed from `__init__.py` | Done | Cleaned up |
| Full legacy module removal | Done | Removed 6 unused modules |

---

## Outstanding Items

### Medium Priority (Security)

| Item | Priority | Risk | Description |
|------|----------|------|-------------|
| Milestone 3B: Input sanitization | P2 | Medium | Normalize user input (strip injection boilerplate) |
| Milestone 3C: Strict output parsing | P2 | Medium | JSON schema validation for LLM responses |
| Milestone 4: Trust boundaries | P2 | Medium/High | Tag sources as trusted/untrusted, UI warnings |

### Low Priority (Future)

| Item | Priority | Description |
|------|----------|-------------|
| Milestone 5: Tool-use safety | P3 | Allowlists/sandboxing (only needed if tools added) |
| Redis rate limiting | P3 | For multi-worker production deployments |
| OCR fallback for scanned PDFs | P3 | Currently yields empty text |

---

## Future Roadmap

### Ground Truth Management (Not Started)

| Feature | Priority | Description |
|---------|----------|-------------|
| Ground Truth UI | High | CRUD interface for expected answers |
| Bulk Import | Medium | CSV/JSON import for ground truths |
| Batch Evaluation | High | Run evals against all ground truths |

### Evaluation Enhancements (Not Started)

| Feature | Priority | Description |
|---------|----------|-------------|
| Evaluation History | Medium | View trends over time |
| Comparison Dashboard | Medium | Compare eval runs side-by-side |
| Export Results | Low | Export to CSV/JSON |

### Search Enhancements (Not Started)

| Feature | Priority | Description |
|---------|----------|-------------|
| Multi-collection Search | Medium | Search across selected collections |
| Saved Searches | Low | Save and rerun queries |
| Search Suggestions | Low | Query autocomplete |

---

## Architecture Notes

### Key Design Decisions

1. **Single ChromaDB Collection**: All chunks in one collection with metadata filtering
2. **BM25 In-Memory**: Per-collection cache with invalidation on document changes
3. **RRF for Fusion**: Robust to score distribution differences between BM25 and semantic
4. **Two-Tier Config**: .env for infrastructure, DB for user preferences

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Dec 2024 | Initial release with core features |
| 1.1.0 | Dec 2024 | Added LLM-as-Judge evaluation |
| 1.2.0 | Dec 2024 | Multi-provider support (Ollama, Anthropic) |
| 1.3.0 | Dec 2024 | Configuration hierarchy separation |
| 1.4.0 | Jan 2025 | Prompt injection mitigations (M1 + M2) |

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [README.md](../README.md) | Project overview, quick start |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Detailed system design, data flows |
| [INFRASTRUCTURE.md](INFRASTRUCTURE.md) | Setup guide for all services |
| [SETUP.md](SETUP.md) | Quick-start setup checklist |
| [CONFIGURATION_STRATEGY.md](CONFIGURATION_STRATEGY.md) | Config hierarchy details |
| [PERFORMANCE_CONSIDERATIONS.md](PERFORMANCE_CONSIDERATIONS.md) | Optimization guide |

---

*This document consolidates: MILESTONES.md, ANALYSIS.md, PROMPT_INJECTION_PLAN.md, MILESTONES_UNUSED_CLEANUP.md*
