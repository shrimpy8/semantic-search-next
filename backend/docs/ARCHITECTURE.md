# Semantic Search Architecture

This document explains the hybrid search retrieval system, scoring mechanisms, and trust considerations.

## Table of Contents

1. [System Overview](#system-overview)
2. [Retrieval Pipeline](#retrieval-pipeline)
3. [Scoring System](#scoring-system)
4. [Score Interpretation Guide](#score-interpretation-guide)
5. [Trust Considerations](#trust-considerations)
6. [Configuration Options](#configuration-options)

---

## System Overview

The search system uses a **hybrid retrieval** approach that combines multiple search methods to maximize both precision and recall:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER QUERY                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌───────────────────┐           ┌───────────────────┐
        │  SEMANTIC SEARCH  │           │   BM25 SEARCH     │
        │   (ChromaDB +     │           │   (Keyword-based) │
        │    Embeddings)    │           │                   │
        └───────────────────┘           └───────────────────┘
                    │                               │
                    │ semantic_score                │ bm25_score
                    │ (0.0 - 1.0)                   │ (normalized 0.0 - 1.0)
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
                    ┌───────────────────────────────┐
                    │     RRF FUSION                │
                    │  (Reciprocal Rank Fusion)     │
                    │  Merges results, deduplicates │
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │        RERANKER               │
                    │   (Jina Cross-Encoder)        │
                    │   Independent relevance       │
                    │   judgment on ALL results     │
                    └───────────────────────────────┘
                                    │
                                    │ rerank_score → final_score
                                    │ (0.0 - 1.0)
                                    ▼
                    ┌───────────────────────────────┐
                    │      FINAL RESULTS            │
                    │  Sorted by final_score        │
                    └───────────────────────────────┘
```

---

## Retrieval Pipeline

### Stage 1: Parallel Retrieval

Two independent search methods run simultaneously:

#### 1.1 Semantic Search (Vector Similarity)

**Component:** `app/core/vector_store.py` → ChromaDB
**Embedding Model:** OpenAI `text-embedding-3-large`

**How it works:**
1. Query text is converted to a 3072-dimensional vector using OpenAI embeddings
2. ChromaDB performs approximate nearest neighbor search
3. Returns documents with highest cosine similarity to query vector

**Strengths:**
- Understands meaning, synonyms, and concepts
- "neural networks" matches "deep learning architectures"

**Weaknesses:**
- May miss exact keyword matches
- Embedding quality depends on model

**Score produced:** `semantic_score` (0.0 - 1.0, cosine similarity)

#### 1.2 BM25 Search (Keyword Matching)

**Component:** `app/core/bm25_retriever.py`
**Algorithm:** Okapi BM25 (k1=1.5, b=0.75)

**How it works:**
1. Query and documents are tokenized into terms
2. BM25 calculates term frequency × inverse document frequency
3. Returns documents with highest keyword overlap

**Strengths:**
- Precise for exact term matches
- Fast and interpretable
- "Python 3.12" matches exactly

**Weaknesses:**
- No semantic understanding
- "automobile" won't match "car"

**Score produced:** `bm25_score` (originally unbounded, normalized to 0.0 - 1.0)

### Stage 2: RRF Fusion

**Component:** `app/core/hybrid_retriever.py:139-202`

Reciprocal Rank Fusion merges results from both retrievers:

```python
RRF_score(d) = Σ 1 / (k + rank(d))
```

Where `k=60` (constant to prevent high ranks from dominating).

**Key behavior:**
- Documents found by BOTH methods get scores from both
- Documents found by ONLY ONE method have `None` for the other score
- Duplicate documents are merged (same chunk ID)

**Result:** A unified candidate set with:
- `semantic_score`: float or `None` (not found by semantic)
- `bm25_score`: float or `None` (not found by BM25)

### Stage 3: Reranking

**Component:** `app/core/reranker.py`
**Model:** `jinaai/jina-reranker-v1-tiny-en` (Cross-Encoder)

**How it works:**
1. Takes (query, document) pairs
2. Feeds both through a transformer model together
3. Outputs a relevance probability (0.0 - 1.0)

**Critical insight:** The reranker makes an **INDEPENDENT** judgment. It:
- Does NOT use semantic_score or bm25_score as input
- Reads the actual query and document text
- Can disagree with both retrieval methods

**Why reranker can be high when others are low:**
```
Example:
  Query: "neural network training"
  Document: "Deep learning model optimization techniques..."

  Semantic: 0.15 (embeddings don't align well)
  BM25: None (exact terms not present)
  Reranker: 0.72 (understands "optimization" relates to "training")
```

**Score produced:** `rerank_score` (0.0 - 1.0, relevance probability)

### Stage 4: Final Scoring

When reranking is enabled:
```
final_score = rerank_score
relevance_percent = int(final_score * 100)
```

When reranking is disabled:
```
final_score = rrf_fusion_score
relevance_percent = scaled version of RRF score
```

---

## Scoring System

### Score Definitions

| Score | Source | Range | When NULL |
|-------|--------|-------|-----------|
| `semantic_score` | ChromaDB cosine similarity | 0.0 - 1.0 | Document not found by semantic search |
| `bm25_score` | BM25 algorithm (normalized) | 0.0 - 1.0 | Document not found by keyword search |
| `rerank_score` | Jina cross-encoder | 0.0 - 1.0 | Reranking disabled |
| `final_score` | = rerank_score (or RRF) | 0.0 - 1.0 | Never null |
| `relevance_percent` | = final_score × 100 | 0 - 100 | Never null |

### Score Normalization

**BM25 scores** are originally unbounded (can be 0 to infinity). They are normalized:
```python
normalized_bm25 = bm25_score / max_bm25_in_result_set
```

This makes them relative within each search result set.

**Important:** A bm25_score of 0.1 means "10% of the highest BM25 score in this result set", NOT "10% relevant".

**Semantic scores** are already 0-1 (cosine similarity) and passed through unchanged.

### Score Transparency Principles

1. **No artificial floors:** Scores are not inflated. A 0% BM25 score means zero keyword relevance.
2. **NULL means not found:** If a score is NULL, the document was NOT retrieved by that method.
3. **Reranker is independent:** Rerank score is computed separately from retrieval scores.
4. **Final score determines ranking:** Results are ordered by `final_score`, not individual component scores.

---

## Score Interpretation Guide

### Reading Search Results

```
Result 1:
  Relevance: 93% | Semantic: 85% | BM25: 100% | Rerank: 93%

  Interpretation:
  - Found by both semantic AND keyword search (both have scores)
  - Highest BM25 match in result set (100% normalized)
  - Strong semantic similarity (85%)
  - Reranker confirms high relevance (93%)
  - High confidence result
```

```
Result 2:
  Relevance: 45% | Semantic: 62% | BM25: N/A | Rerank: 45%

  Interpretation:
  - Found ONLY by semantic search (BM25 is N/A)
  - No keyword overlap with query
  - Reranker thinks it's moderately relevant (45%)
  - May be a conceptual match without exact terms
```

```
Result 3:
  Relevance: 28% | Semantic: N/A | BM25: 12% | Rerank: 28%

  Interpretation:
  - Found ONLY by keyword search (Semantic is N/A)
  - Low keyword match relative to other results (12%)
  - Reranker upgraded it slightly (28%)
  - Query terms appear but embeddings don't match
```

### Common Patterns

| Pattern | Meaning |
|---------|---------|
| High Semantic, High BM25 | Strong match - both meaning and keywords align |
| High Semantic, Low/N/A BM25 | Conceptual match - related topic, different words |
| Low/N/A Semantic, High BM25 | Keyword match - exact terms but maybe different context |
| All Low but still in results | Reranker found some relevance others missed |

---

## Trust Considerations

### Why Results May Seem Unexpected

**Scenario: Document appears with Semantic=N/A, BM25=2%, Rerank=35%**

This happens because:
1. Document was found by BM25 with very low score (bottom of keyword results)
2. Semantic search didn't find it at all
3. BUT the reranker (reading actual text) found it 35% relevant

**Is this trustworthy?**

The reranker is a neural network trained on relevance judgments. It can:
- Understand paraphrases and related concepts
- See relationships humans would recognize
- Make mistakes (it's not perfect)

**Trust framework:**
- `relevance_percent >= 70%`: High confidence
- `relevance_percent 40-69%`: Moderate confidence, worth reviewing
- `relevance_percent < 40%`: Low confidence, may be tangentially related

### Data Integrity Guarantees

1. **Scores are never fabricated:** We don't add artificial minimums or floors
2. **NULL means genuinely not found:** Not hidden or suppressed
3. **Normalization is relative:** BM25 % is relative to result set, not absolute
4. **Reranker operates independently:** Cannot be gamed by retrieval scores

### Potential Failure Modes

| Issue | Symptom | Mitigation |
|-------|---------|------------|
| Embedding model mismatch | Good keywords, bad semantic | Use consistent embedding model |
| BM25 vocabulary gap | Related concepts, no keyword match | Rely on reranker for these |
| Reranker hallucination | High rerank for irrelevant docs | Cross-check with retrieval scores |
| Stale BM25 cache | New docs not in keyword results | Cache invalidated on upload/delete |

### Semantic Search Always Returns Results

**Important behavior:** Semantic search returns the top-k **most similar** documents, even if none are truly relevant.

**Example:**
```
Query: "AI" in a collection of 1970s Buffett letters

Result 1: 1979ltr.pdf
  Semantic: 20% | BM25: N/A | Rerank: 27%

Result 2: 1981ltr.pdf
  Semantic: 12% | BM25: N/A | Rerank: 26%
```

**Why this happens:**
- ChromaDB performs approximate nearest neighbor search
- It returns the k closest vectors, regardless of absolute distance
- Even completely unrelated documents have *some* cosine similarity (not exactly 0)
- The 1970s letters don't mention "AI" but have English words that share embedding space

**How to interpret:**
- `BM25 = N/A` confirms the term doesn't appear in the document
- Low semantic scores (< 30%) indicate weak conceptual relationship
- Low rerank scores (< 30%) confirm the reranker also doesn't see relevance
- **All low scores together = likely irrelevant result**

**Trust guidance:**
| Score Pattern | Interpretation |
|--------------|----------------|
| Semantic > 50%, BM25 > 50%, Rerank > 60% | Highly relevant |
| Semantic > 30%, BM25 = N/A, Rerank > 50% | Conceptually related |
| Semantic < 30%, BM25 = N/A, Rerank < 30% | **Likely irrelevant** - best match in poor corpus |

**Future consideration:** Add configurable minimum score threshold to filter out low-confidence results.

---

## Configuration Options

### Search Presets

| Preset | Alpha | Behavior |
|--------|-------|----------|
| `high_precision` | 0.85 | Heavy semantic weight, fewer results |
| `balanced` | 0.50 | Equal semantic + keyword weight |
| `high_recall` | 0.30 | More keyword weight, larger result set |

**Alpha** controls the blend:
- `alpha=1.0`: Pure semantic search
- `alpha=0.5`: Equal weight
- `alpha=0.0`: Pure keyword search

### Reranking Toggle

When `use_reranker=false`:
- `rerank_score` will be NULL
- `final_score` uses RRF fusion score instead
- Faster but less accurate ranking

### Relevant Files

| File | Purpose |
|------|---------|
| `app/core/vector_store.py` | ChromaDB + embeddings |
| `app/core/bm25_retriever.py` | BM25 keyword search |
| `app/core/hybrid_retriever.py` | RRF fusion logic |
| `app/core/reranker.py` | Jina cross-encoder |
| `app/services/retrieval.py` | Service orchestration |
| `app/api/v1/search.py` | API endpoint + score normalization |

---

## Appendix: Score Flow Diagram

```
Document "Deep learning optimization"
Query: "neural network training"

┌─────────────────────────────────────────────────────────────────┐
│ SEMANTIC SEARCH                                                  │
│ ───────────────                                                  │
│ 1. Embed query → [0.23, -0.15, 0.87, ...]                       │
│ 2. Compare to doc embedding via cosine similarity               │
│ 3. Result: 0.42 (moderate similarity)                           │
│                                                                  │
│ OUTPUT: semantic_score = 0.42                                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ BM25 SEARCH                                                      │
│ ───────────                                                      │
│ 1. Tokenize: ["neural", "network", "training"]                  │
│ 2. Check doc: ["deep", "learning", "optimization"]              │
│ 3. No term overlap!                                              │
│                                                                  │
│ OUTPUT: bm25_score = NULL (not retrieved by BM25)               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ RRF FUSION                                                       │
│ ──────────                                                       │
│ Document found by semantic (rank 5), not by BM25                │
│ RRF = 1/(60+5) = 0.0154                                         │
│                                                                  │
│ OUTPUT: Candidate with semantic_score=0.42, bm25_score=NULL     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ RERANKER                                                         │
│ ────────                                                         │
│ Input: ("neural network training", "Deep learning optimization")│
│ Cross-encoder processes BOTH texts together                     │
│ Understands: optimization ≈ training, deep learning ≈ neural   │
│                                                                  │
│ OUTPUT: rerank_score = 0.68                                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ FINAL OUTPUT                                                     │
│ ────────────                                                     │
│ semantic_score:   0.42 (42%)                                    │
│ bm25_score:       NULL (N/A - not found by keyword search)      │
│ rerank_score:     0.68 (68%)                                    │
│ final_score:      0.68 (= rerank_score)                         │
│ relevance_percent: 68                                            │
└─────────────────────────────────────────────────────────────────┘
```

This document should be updated when scoring logic changes.
