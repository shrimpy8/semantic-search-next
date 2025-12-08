# In Progress - Semantic Search Development

**Last Updated:** 2025-12-07
**Session End State:** Stage 2.5 features complete, all systems operational

---

## Current State Summary

The semantic search application is fully functional with comprehensive features.

### Stage 2.5 Completed Features

1. **AI Answer Generation with Verification** ✅
   - RAG-powered answers using retrieved document context
   - Citation extraction and claim verification
   - Confidence scoring (high/medium/low/unverified)
   - UI indicator on home page showing when AI Answer is enabled
   - Files: `qa_chain.py`, `answer_verifier.py`, `search-results.tsx`

2. **Search Analytics Dashboard** ✅
   - `/analytics` page with search history table
   - Latency trend chart (line chart)
   - Query volume chart (bar chart)
   - Time range filtering (2 days, 7 days, 15 days)
   - Files: `analytics.py`, `analytics/page.tsx`

3. **Document Preview/Content Viewer** ✅
   - `/documents/[id]` page with tabbed interface
   - Full document content with chunk boundaries
   - Chunk navigation and metadata display
   - Jump-to-chunk from search results
   - Files: `documents/[id]/page.tsx`, `document-viewer.tsx`

4. **Context Expansion** ✅
   - `context_before` and `context_after` fields in search results
   - Configurable `default_context_window` setting
   - Shows surrounding context for better understanding

5. **Externalized LLM Prompts** ✅
   - All prompts moved to YAML files (`prompts/qa.yaml`, `prompts/verification.yaml`)
   - PromptManager class for loading and variable substitution
   - Prompts can be modified without code changes

6. **Multiple Embedding Providers** ✅
   - OpenAI (default), Ollama (local), Jina, Cohere, Voyage AI
   - EmbeddingFactory with unified interface
   - Model format: `provider:model_name`

7. **DEBUG Mode** ✅
   - Backend: `DEBUG=true` in `.env` for verbose logging
   - Frontend: `NEXT_PUBLIC_DEBUG=true` for console logging

### Earlier Completed Features

8. **BM25 Cache Invalidation** ✅
   - Cache invalidated on document upload/delete

9. **Low-Confidence Result Filtering** ✅
   - Results split by `min_score_threshold`
   - Toggle to reveal low-confidence results

10. **Score Display** ✅
    - Proper normalization and percentage display

---

## System Architecture

### Running Services
- **Backend:** FastAPI on port 8080 (`uvicorn app.main:app --reload --port 8080`)
- **Frontend:** Next.js on port 3000 (`npm run dev`)
- **PostgreSQL:** Docker container `semantic-search-postgres` on port 5432
- **ChromaDB:** Docker container `chroma` on port 8000
- **PgAdmin:** Docker container `semantic-search-pgadmin` on port 5050

### Start Commands
```bash
# Start Docker services
cd /Users/harshh/Documents/GitHub/semantic-search-next
docker-compose up -d

# Start backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8080

# Start frontend (separate terminal)
cd frontend
npm run dev
```

---

## Key Files Reference

### Backend Core Files
| File | Purpose |
|------|---------|
| `backend/app/api/v1/search.py` | Search endpoint with AI answers |
| `backend/app/api/v1/analytics.py` | Analytics endpoints |
| `backend/app/api/v1/documents.py` | Document upload/content |
| `backend/app/core/qa_chain.py` | RAG answer generation |
| `backend/app/core/answer_verifier.py` | Citation verification |
| `backend/app/core/embeddings.py` | Multi-provider embedding factory |
| `backend/app/prompts/` | Externalized LLM prompts (YAML) |
| `backend/app/services/retrieval.py` | HybridSearchService with BM25 cache |
| `backend/app/core/hybrid_retriever.py` | RRF fusion logic |
| `backend/app/core/reranker.py` | Jina/Cohere reranking |

### Frontend Core Files
| File | Purpose |
|------|---------|
| `frontend/src/app/page.tsx` | Main search page with AI indicator |
| `frontend/src/app/analytics/page.tsx` | Analytics dashboard |
| `frontend/src/app/documents/[id]/page.tsx` | Document preview |
| `frontend/src/components/search/search-results.tsx` | Results with AI answers |
| `frontend/src/components/search/search-result-card.tsx` | Individual result card |
| `frontend/src/lib/api/` | API clients (search, analytics, settings) |
| `frontend/src/lib/debug.ts` | Debug logging utility |

---

## Database Schema

### Settings Table (PostgreSQL)
```sql
-- Key columns
id UUID PRIMARY KEY
default_alpha FLOAT  -- Hybrid search alpha (0-1)
default_use_reranker BOOLEAN
default_preset VARCHAR  -- high_precision/balanced/high_recall
default_top_k INTEGER
min_score_threshold FLOAT  -- Low-confidence cutoff (default: 0.30)
embedding_model VARCHAR
chunk_size INTEGER
chunk_overlap INTEGER
show_scores BOOLEAN
```

### Recent Migration
```sql
-- Added in this session
ALTER TABLE settings ADD COLUMN IF NOT EXISTS min_score_threshold FLOAT DEFAULT 0.30 NOT NULL;
```

---

## API Response Format

### Search Response
```json
{
  "query": "search query",
  "results": [...],                    // High-confidence results (>= threshold)
  "low_confidence_results": [...],     // Low-confidence results (< threshold)
  "low_confidence_count": 3,           // Count of hidden results
  "min_score_threshold": 0.30,         // Current threshold
  "latency_ms": 245,
  "retrieval_method": "balanced"
}
```

### Search Result Scores
```json
{
  "scores": {
    "semantic_score": 0.85,    // Normalized 0-1
    "bm25_score": 0.72,        // Normalized 0-1
    "rerank_score": 0.92,      // Cross-encoder 0-1 (when reranking enabled)
    "final_score": 0.92,       // Used for ranking/filtering
    "relevance_percent": 92    // Display value (0-100%)
  }
}
```

---

## Search Flow

1. **Query embedding** via OpenAI `text-embedding-3-large`
2. **Parallel retrieval:**
   - Semantic search via ChromaDB (cosine similarity)
   - BM25 keyword search (in-memory, per-collection cache)
3. **Reciprocal Rank Fusion (RRF)** to merge results
4. **Reranking** via Jina cross-encoder (local model)
5. **Confidence filtering** based on `min_score_threshold`
6. **Response** with high/low confidence separation

---

## Potential Next Tasks

Remaining items from Stage 2.5 plan (low priority):

1. **Backend Test Suite** (P3)
   - pytest configuration with async support
   - API endpoint tests (~20 tests)
   - Core service tests (~10 tests)
   - Target: ~60% code coverage

2. **Query Understanding** (P4 - Low Priority)
   - Acronym expansion (ML → machine learning)
   - Optional synonym expansion
   - Show "Also searched for: X" in UI

3. **Document Structure Awareness** (P5 - Low Priority)
   - Extract headings during chunking
   - Show heading breadcrumbs in results
   - Optional heading boost in scoring

4. **Batch Document Upload**
   - Upload multiple files at once
   - Progress tracking per file

5. **PDF Viewer Integration**
   - Use `react-pdf` for PDF rendering
   - Highlight matched chunks on pages

---

## Issues Found During Testing & Lessons Learned

### Issue 1: BM25 Cache Never Invalidated
**Problem:** After uploading new documents, search results didn't include them. The same 3 documents returned for completely different queries.

**Root Cause:** `HybridSearchService` cached BM25 indices per collection in `_bm25_indices` dict, but `invalidate_bm25_cache()` was never called after document upload/delete.

**Code Path:**
- Cache check: `retrieval.py:155` - `if collection_id not in self._bm25_indices`
- Cache exists but stale → new documents never indexed for BM25
- `invalidate_bm25_cache()` existed at `retrieval.py:170-177` but was dead code

**Fix:** Added `search_service.invalidate_bm25_cache(str(collection_id))` call in `documents.py` after successful upload and delete operations.

**Lesson Learned:**
- When implementing caching, always implement invalidation at the same time
- Create a checklist: "What operations should invalidate this cache?"
- Add integration tests that verify cache invalidation (upload doc → search → verify new doc appears)

---

### Issue 2: Database Migration Not Applied
**Problem:** Backend crashed with `asyncpg.exceptions.UndefinedColumnError: column settings.min_score_threshold does not exist`

**Root Cause:** SQLAlchemy model was updated to add `min_score_threshold` column, but the actual PostgreSQL table was never migrated.

**Fix:** Ran manual SQL migration:
```sql
ALTER TABLE settings ADD COLUMN IF NOT EXISTS min_score_threshold FLOAT DEFAULT 0.30 NOT NULL;
```

**Lesson Learned:**
- Always run database migrations after modifying SQLAlchemy models
- Use Alembic for automatic migration generation: `alembic revision --autogenerate -m "add min_score_threshold"`
- Add pre-commit hook or CI check that verifies model/DB schema sync
- Consider adding a startup check that compares model columns vs DB columns

---

### Issue 3: Score Display Showing Wrong Values
**Problem:** `relevance_percent` was showing 0% or incorrect values even for highly relevant results.

**Root Cause:**
1. `relevance_percent` was being calculated from wrong score field
2. BM25 scores were unbounded (could be >1) making normalization inconsistent
3. An artificial 5% floor was applied to semantic scores, distorting low scores

**Fix:**
- Calculate `relevance_percent` directly from `final_score` (which is 0-1 when reranking)
- Normalize BM25 to 0-1 by dividing by max BM25 score in result set
- Removed artificial floor on semantic scores

**Lesson Learned:**
- Document expected value ranges for all score fields (0-1, 0-100, unbounded)
- Add validation/assertions: `assert 0 <= score <= 1, f"Score {score} out of range"`
- Create unit tests for score calculations with known inputs/outputs

---

### Issue 4: Low-Confidence Results Not Separated
**Problem:** Semantic search returned results for completely unrelated queries (e.g., "quantum physics" returning ML documents).

**Root Cause:** Semantic similarity always finds "closest" matches even if nothing is truly relevant. No filtering based on absolute relevance threshold.

**Fix:** Implemented confidence-based filtering:
- Added `min_score_threshold` setting (default 30%)
- Split results into `results` (high-confidence) and `low_confidence_results`
- Frontend hides low-confidence by default with toggle to reveal

**Lesson Learned:**
- Semantic search ALWAYS returns results - design for "no good matches" scenario
- Implement relevance thresholds from the start, not as afterthought
- Show users transparency about confidence levels

---

## UI Issues Found During Testing

### UI Issue 1: Relevance Percentage Showing 0% for All Results
**Problem:** Search result cards displayed "0%" relevance even for highly relevant results. Users had no idea which results were actually good.

**Root Cause:** The `relevance_percent` in the UI was reading from the wrong field or the backend wasn't calculating it correctly. The display component showed `scores.relevance_percent` but this was either null or 0.

**Symptoms:**
- All result cards showed "0% relevance"
- Score breakdown section was confusing/misleading
- Users couldn't distinguish good from bad results

**Fix:**
- Ensured `relevance_percent` is calculated as `Math.round(final_score * 100)` on backend
- Updated `search-result-card.tsx` to display correctly
- Added fallback: if `relevance_percent` is 0 but `final_score` exists, calculate on frontend

**Lesson Learned:**
- Always test with real data, not just mock data that always returns perfect scores
- Add unit tests for score display formatting
- Consider frontend fallback calculations for robustness

---

### UI Issue 2: No Visual Distinction for Low-Confidence Results
**Problem:** Low-confidence results looked identical to high-confidence results when shown. Users couldn't tell the difference.

**Root Cause:** Initial implementation just hid low-confidence results entirely, but when revealed they had no visual indicator.

**Fix:** Added amber visual indicators:
- Amber left border (`bg-amber-400 dark:bg-amber-600`) on low-confidence result cards
- Warning banner with amber styling explaining the threshold
- `AlertTriangle` icon to draw attention

**Files Modified:** `frontend/src/components/search/search-results.tsx`

**Lesson Learned:**
- Visual hierarchy matters - different states need different visual treatments
- Use color consistently (amber = caution/low-confidence)
- Always include explanatory text with visual indicators

---

### UI Issue 3: No "Only Low Confidence Results" State
**Problem:** When a search returned only low-confidence results (no high-confidence matches), the UI showed "No results found" which was misleading.

**Root Cause:** The conditional logic only checked `data.results.length === 0` without considering `low_confidence_results`.

**Symptoms:**
- Searching for unrelated terms showed "No results found"
- Low-confidence results existed but were completely hidden
- User had no indication that partial matches existed

**Fix:** Added special UI state for "only low-confidence results":
```tsx
// Special case: Only low-confidence results found
if (!hasHighConfidenceResults && hasLowConfidenceResults) {
  return (
    <div>
      {/* Warning banner: "No confident matches found" */}
      {/* Toggle to reveal low-confidence results */}
    </div>
  );
}
```

**Files Modified:** `frontend/src/components/search/search-results.tsx:72-126`

**Lesson Learned:**
- Always design for edge cases: all results, some results, no confident results, no results at all
- Create a state matrix during design: `{highConf: true/false} x {lowConf: true/false}`
- Each state needs its own UI treatment

---

### UI Issue 4: Search Results Not Updating After Document Upload
**Problem:** After uploading a new document, searching for content in that document returned nothing. User had to manually refresh the page.

**Root Cause:** This was actually the BM25 cache issue manifesting in the UI. But from UI perspective, the symptom was stale search results.

**Symptoms:**
- Upload document → Search for content → Nothing found
- Same 3 old documents kept appearing for every query
- User confusion about whether upload worked

**Fix:** Backend fix (BM25 cache invalidation), but UI could add:
- Toast notification after upload: "Document indexed. Search is now up to date."
- Consider showing "last indexed" timestamp on documents

**Lesson Learned:**
- UI should give feedback about system state, not just operation success
- "Document uploaded" is not the same as "Document searchable"
- Consider polling or websocket updates for background processing status

---

### UI Issue 5: Type Mismatch - Frontend Expected Fields Backend Didn't Send
**Problem:** TypeScript compiled fine but runtime showed `undefined` for `low_confidence_results` because the backend wasn't sending it initially.

**Root Cause:**
- Added types to `frontend/src/lib/api/search.ts` (SearchResponse)
- Backend schema was updated but search endpoint wasn't returning the new fields
- TypeScript types don't validate at runtime

**Symptoms:**
- `data.low_confidence_results.map()` crashed with "Cannot read property 'map' of undefined"
- Console errors in browser
- White screen/partial render

**Fix:**
- Ensured backend returns all fields even if empty: `low_confidence_results: []`
- Added defensive checks in frontend: `data.low_confidence_results?.map()` or `data.low_confidence_count ?? 0`

**Lesson Learned:**
- TypeScript types are compile-time only - add runtime validation
- When adding new response fields, update frontend AND backend together
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safety
- Consider Zod or similar for runtime type validation

---

## Prevention Checklist for Future Development

### Before Implementing Caching
- [ ] Define cache invalidation triggers (what operations invalidate?)
- [ ] Implement invalidation alongside caching, not later
- [ ] Add integration test: operation → cache invalidated → fresh data returned

### Before Modifying Database Models
- [ ] Create Alembic migration: `alembic revision --autogenerate -m "description"`
- [ ] Run migration: `alembic upgrade head`
- [ ] Verify in DB: `\d table_name` in psql
- [ ] Test API endpoint that uses new column

### Before Implementing Score/Ranking Systems
- [ ] Document expected value ranges for each score type
- [ ] Add normalization for unbounded scores
- [ ] Add validation assertions for score ranges
- [ ] Create unit tests with known input/output pairs
- [ ] Handle edge cases: empty results, all low scores, all high scores

### Before Shipping Search Features
- [ ] Test with unrelated queries - what happens?
- [ ] Implement relevance thresholds
- [ ] Design "no good results" UI state
- [ ] Show confidence/relevance to users

### Before Shipping UI Features
- [ ] Create state matrix: identify all possible states (loading, error, empty, partial, full)
- [ ] Design each state visually - never leave a state unhandled
- [ ] Add visual indicators for quality/confidence levels (colors, icons, badges)
- [ ] Use defensive coding: optional chaining (`?.`) and nullish coalescing (`??`)
- [ ] Test with backend returning unexpected/missing fields
- [ ] Add runtime validation (Zod) for API responses in production apps
- [ ] Include explanatory text with visual changes - don't rely on color alone

### Frontend/Backend Sync
- [ ] Update TypeScript types and backend schemas together
- [ ] Ensure backend returns all fields, even if empty (`[]`, `null`)
- [ ] Test the full flow: action → backend → frontend → UI update
- [ ] Add toast/feedback for background processes (indexing, processing)

---

## Known Issues

None currently blocking. All Stage 2.5 features complete and tested.

### Fixed Issues This Session
- Search timeout (10s → 60s for RAG queries)
- AI Answer indicator on home page
- Analytics time range options (2d, 7d, 15d)

---

## Test Queries

```bash
# High-confidence query (relevant to indexed docs)
curl -s -X POST "http://localhost:8080/api/v1/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "AI", "preset": "balanced", "top_k": 5}'

# Low-confidence query (unrelated to docs)
curl -s -X POST "http://localhost:8080/api/v1/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "quantum entanglement physics", "preset": "balanced", "top_k": 10}'

# Check settings
curl -s http://localhost:8080/api/v1/settings

# Health check
curl -s http://localhost:8080/api/v1/health
```

---

## Environment

- **Platform:** macOS (Darwin 25.1.0, Apple Silicon)
- **Python:** 3.11+ with venv at `backend/.venv`
- **Node.js:** 18+ for Next.js frontend
- **Docker:** PostgreSQL 15, ChromaDB latest
