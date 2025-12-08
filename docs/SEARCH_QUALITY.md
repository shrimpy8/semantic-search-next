# Search Quality Improvements - Analysis & Implementation Plan

> **Document Purpose**: Capture all details for 4 search quality improvements with UI implications and implementation TODOs.
>
> **Implementation Scope**: P1 (Answer Verification) + P2 (Context Retrieval) = ~3 days
>
> **Save Location**: `docs/SEARCH_QUALITY.md` in project root

---

## Implementation Plan (P1 + P2)

### Phase 1: Answer Verification (P1) - ~2 days
**Goal**: Ensure AI-generated answers are grounded in retrieved documents

1. **Backend** (`backend/app/core/answer_verifier.py`)
   - Create `AnswerVerifier` class
   - Implement citation extraction from generated answer
   - Add verification LLM call to check grounding
   - Calculate confidence score

2. **Backend Schema** (`backend/app/api/schemas.py`)
   - Add `answer_confidence: str | None`
   - Add `answer_citations: list[Citation] | None`
   - Add `answer_warning: str | None`

3. **Backend Integration** (`backend/app/api/v1/search.py`)
   - Call verifier after QAChain generates answer
   - Return verification data in response

4. **Frontend Types** (`frontend/src/lib/api/types.ts`)
   - Add verification fields to `SearchResponse`
   - Add `Citation` interface

5. **Frontend Components**
   - Create `components/search/confidence-badge.tsx`
   - Create `components/search/answer-with-citations.tsx`
   - Update `search-results.tsx` AI Answer card

### Phase 2: Context Retrieval (P2) - ~1 day
**Goal**: Show surrounding context for search results

1. **Backend** (`backend/app/core/document_processor.py`)
   - Ensure chunk_index is tracked in metadata

2. **Backend** (`backend/app/services/retrieval.py`)
   - Add context expansion logic (fetch adjacent chunks)
   - Add `include_context` parameter

3. **Backend Schema** (`backend/app/api/schemas.py`)
   - Add `context_before: str | None`
   - Add `context_after: str | None`

4. **Frontend Types** (`frontend/src/lib/api/types.ts`)
   - Add context fields to `SearchResult`

5. **Frontend Component** (`frontend/src/components/search/search-result-card.tsx`)
   - Add expandable context view
   - Style matched chunk vs context

---

## TODOs Summary

### Issue 1: Contextual Chunk Retrieval (Parent Document / Surrounding Context)
- [ ] **Backend**: Modify chunking to track parent relationships (chunk_index, total_chunks, document_id)
- [ ] **Backend**: Add `include_context` parameter to search endpoint
- [ ] **Backend**: Implement context expansion logic (fetch adjacent chunks by chunk_index)
- [ ] **Frontend**: Update `SearchResult` type with `context_before`, `context_after` fields
- [ ] **Frontend**: Redesign `search-result-card.tsx` with expandable context view
- [ ] **Frontend**: Add "Show context" / "Hide context" toggle
- [ ] **Frontend**: Style highlighted matched chunk vs surrounding context
- [ ] **Testing**: Test with various document types (PDF, TXT, MD)

### Issue 2: Query Understanding / Preprocessing
- [ ] **Backend**: Create `QueryPreprocessor` class
- [ ] **Backend**: Implement acronym expansion dictionary
- [ ] **Backend**: Implement synonym mapping (optional LLM-based)
- [ ] **Backend**: Add query decomposition for multi-part questions
- [ ] **Backend**: Add `preprocessed_query` to search response for transparency
- [ ] **Frontend**: Show "Searched for: X" when query was expanded
- [ ] **Testing**: Benchmark recall improvement with query expansion

### Issue 3: Document Structure Awareness (Title/Heading Weighting)
- [ ] **Backend**: Extract headings during document chunking
- [ ] **Backend**: Store heading hierarchy in chunk metadata
- [ ] **Backend**: Implement title/heading boost in scoring
- [ ] **Backend**: Add `heading_match` field to search results
- [ ] **Frontend**: Display heading breadcrumb in result cards
- [ ] **Frontend**: Style heading matches differently from body matches
- [ ] **Testing**: Test with structured documents (markdown, PDF with TOC)

### Issue 4: RAG Answer Verification / Hallucination Detection
- [ ] **Backend**: Create `AnswerVerifier` class
- [ ] **Backend**: Implement citation extraction from generated answer
- [ ] **Backend**: Add verification LLM call to check grounding
- [ ] **Backend**: Calculate confidence score based on citation coverage
- [ ] **Backend**: Add `answer_confidence`, `answer_citations`, `answer_warning` to response
- [ ] **Frontend**: Create `ConfidenceBadge` component
- [ ] **Frontend**: Create `AnswerWithCitations` component with clickable references
- [ ] **Frontend**: Add warning UI for low-confidence answers
- [ ] **Frontend**: Implement scroll-to-source on citation click
- [ ] **Testing**: Test with queries that should return "I don't know"

---

## Issue 1: Contextual Chunk Retrieval

### Problem Statement
Chunks are retrieved in isolation. A 1000-character chunk might be highly relevant but lacks surrounding context, making it hard for users to understand or trust the result.

**Example**: User sees "...as mentioned above, this approach..." with no "above" available.

### Why Implement
- Dramatically improves comprehension of search results
- Reduces "orphan chunk" problem
- Industry standard: LlamaIndex's "Small-to-Big", LangChain's ParentDocumentRetriever
- Builds user trust - they can see the full picture

### Why NOT Implement
- Increases response payload size
- Adds complexity to chunking pipeline (track parent relationships)
- May return redundant information if multiple chunks from same section match
- Current reranker somewhat mitigates this by scoring relevance

### Technical Approach

**Backend Changes** (`backend/app/`):
```
core/document_processor.py   - Track chunk relationships during chunking
api/v1/search.py             - Add include_context parameter
api/schemas.py               - Add context fields to SearchResult
services/retrieval.py        - Implement context expansion logic
```

**New Schema Fields**:
```python
class SearchResultSchema(BaseModel):
    content: str                    # Existing - matched chunk
    context_before: str | None      # NEW - 1-2 chunks before
    context_after: str | None       # NEW - 1-2 chunks after
    chunk_index: int | None         # NEW - position in document
    total_chunks: int | None        # NEW - total chunks in document
```

### UI Implications

**Affected Files**:
| File | Change |
|------|--------|
| `lib/api/types.ts` | Add `context_before`, `context_after` fields |
| `search-result-card.tsx` | **Major redesign** - expandable context view |
| `search-results.tsx` | Pass new props |

**Design Mockup**:
```
+-----------------------------------------------------+
| [1]  document.pdf                    85% match      |
|      Page 12 - #Authentication                      |
+-----------------------------------------------------+
| ...configure the OAuth settings in the admin        |  <- context_before (dimmed)
| panel before proceeding.                            |
|                                                     |
| | The authentication flow uses JWT tokens           |  <- MATCHED CHUNK (highlighted)
| | signed with RS256 algorithm. Users must           |
| | first obtain a refresh token via /auth/login      |
|                                                     |
| After obtaining the token, include it in the        |  <- context_after (dimmed)
| Authorization header for all API calls...           |
+-----------------------------------------------------+
| [v Hide context]  [Score breakdown v]               |
+-----------------------------------------------------+
```

### Effort Estimate
- Backend: 4-6 hours
- Frontend: 3-4 hours
- Testing: 2 hours
- **Total: ~1 day**

---

## Issue 2: Query Understanding / Preprocessing

### Problem Statement
User query goes directly to embedding and BM25 without transformation. Query "ML models" won't BM25-match "machine learning models".

### Why Implement
- Acronym expansion: "API" -> "API OR Application Programming Interface"
- Synonym handling: "delete" -> "delete OR remove OR erase"
- Query decomposition: Complex questions split into sub-queries
- Dramatically improves recall for non-expert users

### Why NOT Implement
- Semantic search ALREADY handles synonyms well (embeddings capture meaning)
- Query expansion can introduce noise (false positives)
- Adds latency (potential LLM call for query rewriting)
- Over-engineering for expert users who know terminology
- Current hybrid approach already provides reasonable coverage

### Technical Approach

**Backend Changes**:
```
core/query_preprocessor.py   - NEW: Query preprocessing logic
api/v1/search.py             - Integrate preprocessor before search
api/schemas.py               - Add preprocessed_query to response
config.py                    - Add enable_query_expansion setting
```

**Preprocessing Pipeline**:
```python
class QueryPreprocessor:
    def preprocess(self, query: str) -> PreprocessedQuery:
        # 1. Acronym expansion (dictionary-based)
        # 2. Synonym expansion (optional)
        # 3. Query decomposition (for multi-part questions)
        return PreprocessedQuery(
            original=query,
            expanded=expanded_query,
            sub_queries=sub_queries,
        )
```

### UI Implications

**Affected Files**:
| File | Change |
|------|--------|
| `lib/api/types.ts` | Add `preprocessed_query` field |
| `search-results.tsx` | Show "Searched for: X" hint |

**Minimal UI Change**:
```
+-----------------------------------------------------+
| 5 results for "ML"                                  |
| (i) Also searched for: "machine learning"           |  <- NEW
+-----------------------------------------------------+
```

### Effort Estimate
- Backend: 6-8 hours (dictionary creation, integration)
- Frontend: 1-2 hours (minor UI hint)
- Testing: 3 hours (recall benchmarking)
- **Total: ~1.5 days**

---

## Issue 3: Document Structure Awareness

### Problem Statement
A match in a section title is treated the same as a match in body text. Chunk metadata has `source` (filename) but headings aren't weighted differently.

### Why Implement
- Document titled "Machine Learning Guide" should rank higher for "machine learning"
- Section headings are high-signal indicators
- Could boost scores for chunks where query terms appear in headings
- Users trust results more when they see structural relevance

### Why NOT Implement
- Reranker (Jina/Cohere) already does cross-attention that recognizes title importance
- Implementation requires document-type-specific parsing (MD != PDF)
- Adds complexity to scoring formula without guaranteed improvement
- Medium priority - reranker handles most cases

### Technical Approach

**Backend Changes**:
```
core/document_processor.py   - Extract headings during chunking
core/hybrid_retriever.py     - Add heading boost to scoring
api/schemas.py               - Add heading_hierarchy field
```

**New Metadata**:
```python
chunk.metadata = {
    "heading_hierarchy": ["Chapter 1", "Authentication", "OAuth Setup"],
    "heading_level": 2,  # h2
    "heading_text": "OAuth Setup",
}
```

### UI Implications

**Affected Files**:
| File | Change |
|------|--------|
| `lib/api/types.ts` | Add `heading_hierarchy` field |
| `search-result-card.tsx` | Show heading breadcrumb |

**Design Addition**:
```
+-----------------------------------------------------+
| [1]  document.pdf                    85% match      |
|      Chapter 1 > Authentication > OAuth             |  <- NEW breadcrumb
|      Page 12                                        |
+-----------------------------------------------------+
```

### Effort Estimate
- Backend: 4-5 hours
- Frontend: 2 hours
- Testing: 2 hours
- **Total: ~1 day**

---

## Issue 4: RAG Answer Verification / Hallucination Detection

### Problem Statement
When `generate_answer=true`, QAChain generates an answer from top 3 chunks. There's no verification that the answer actually comes from the provided context.

**Risk**: LLMs can hallucinate confident-sounding answers not grounded in the context, destroying user trust.

### Why Implement
- User TRUST is critical - wrong answers from "their documents" erodes confidence
- Citation verification: check that claims trace to specific chunks
- "I don't know" detection: if context doesn't contain answer, say so explicitly
- Could add second LLM call: "Does this answer come from the provided context?"

### Why NOT Implement
- Doubles latency (verification LLM call)
- GPT-4o-mini with temperature=0.0 already minimizes hallucination
- Current prompt says "If you can't answer, just say so"
- Users can verify by clicking through to source documents
- May be premature - need real user feedback on hallucination rates first

### Technical Approach

**Backend Changes**:
```
core/answer_verifier.py      - NEW: Verification logic
core/qa_chain.py             - Integrate verifier after generation
api/schemas.py               - Add verification fields to response
```

**Verification Pipeline**:
```python
class AnswerVerifier:
    def verify(self, answer: str, context: str, sources: list) -> VerificationResult:
        # 1. Extract claims from answer
        # 2. For each claim, find supporting quote in context
        # 3. Calculate coverage (% of claims supported)
        # 4. Generate confidence level
        return VerificationResult(
            confidence="high" | "medium" | "low" | "unverified",
            citations=[Citation(text=..., source_index=..., quote=...)],
            warning="Could not verify claim about X" | None,
        )
```

**New Schema Fields**:
```python
class SearchResponse(BaseModel):
    answer: str | None
    answer_confidence: str | None        # NEW: high/medium/low/unverified
    answer_citations: list[Citation]     # NEW: inline citations
    answer_warning: str | None           # NEW: verification warning
```

### UI Implications

**Affected Files**:
| File | Change |
|------|--------|
| `lib/api/types.ts` | Add verification fields, Citation type |
| `search-results.tsx` | **Major redesign** of AI Answer card |
| NEW `components/search/confidence-badge.tsx` | Verification status badge |
| NEW `components/search/answer-with-citations.tsx` | Citations renderer |

**Design Mockup**:
```
+-----------------------------------------------------+
| * AI Answer                         [/ Verified]    |
+-----------------------------------------------------+
|                                                     |
| Machine learning is a subset of AI[1] that          |
| enables systems to learn from data[2] without       |
| explicit programming.                               |
|                                                     |
| -------------------------------------------------   |
| (i) Verified against 2 sources                      |
| [1] document.pdf p.12  [2] guide.md #Intro          |
+-----------------------------------------------------+
```

**Low Confidence Warning**:
```
+-----------------------------------------------------+
| * AI Answer                    [! Low Confidence]   |
+-----------------------------------------------------+
| ! Some claims could not be verified against         |
|   your documents. Please verify manually.           |
|                                                     |
| The API uses OAuth 2.0[1] for authentication.       |
| Rate limits are set to 1000 requests/hour[?].       |  <- [?] = unverified
|                                                     |
+-----------------------------------------------------+
```

### Effort Estimate
- Backend: 6-8 hours (verifier, LLM integration)
- Frontend: 4-5 hours (new components, styling)
- Testing: 3 hours (hallucination test cases)
- **Total: ~1.5-2 days**

---

## Priority Recommendation

| Priority | Issue | Impact | Effort | Recommendation |
|----------|-------|--------|--------|----------------|
| **P1** | #4 Answer Verification | HIGH - Trust | ~2 days | **Implement first** |
| **P2** | #1 Context Retrieval | HIGH - Comprehension | ~1 day | Implement second |
| P3 | #2 Query Understanding | Medium - Recall | ~1.5 days | Monitor first |
| P4 | #3 Structure Awareness | Medium - Quality | ~1 day | Nice-to-have |

**Rationale**:
- Issue #4 (verification) directly addresses trust - a wrong answer is worse than no answer
- Issue #1 (context) is next because it helps users verify answers themselves
- Issues #2 and #3 provide marginal gains given existing hybrid + reranker setup

---

## Implementation Order (If Doing All 4)

1. **Issue #4: Answer Verification** (2 days)
   - Highest trust impact
   - Self-contained backend change
   - Frontend can be progressive (start with confidence badge only)

2. **Issue #1: Context Retrieval** (1 day)
   - High comprehension impact
   - Complements verification (users can check citations in context)

3. **Issue #3: Structure Awareness** (1 day)
   - Relatively simple to add during context work
   - Shares metadata infrastructure with Issue #1

4. **Issue #2: Query Understanding** (1.5 days)
   - Lowest priority - existing system handles most cases
   - Can be added later based on user feedback

**Total: ~5.5 days for all 4 features**
