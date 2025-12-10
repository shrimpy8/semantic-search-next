# Performance Considerations

> Guide to optimizing performance in Semantic Search Next

---

## Current Performance Characteristics

### Search Latency Breakdown

| Component | Typical Latency | Notes |
|-----------|-----------------|-------|
| Query Embedding | 50-150ms | Depends on provider (local vs cloud) |
| Semantic Search | 20-100ms | ChromaDB query time |
| BM25 Search | 5-20ms | In-memory, cached per collection |
| RRF Fusion | <5ms | Pure computation |
| Reranking | 100-500ms | Cross-encoder inference |
| Answer Generation | 1-3s | LLM API call |
| **Total (no answer)** | ~200-800ms | |
| **Total (with answer)** | ~1.5-4s | |

### Memory Usage

| Component | Memory | Notes |
|-----------|--------|-------|
| BM25 Index (per collection) | ~50MB per 10K chunks | Scales with vocabulary |
| Jina Reranker Model | ~500MB | Loaded on first use |
| Embedding Model (Ollama) | 1-4GB | Depends on model size |
| ChromaDB Connection | Minimal | Connection pool |

---

## Optimization Opportunities

### 1. BM25 Cache Optimization

**Current**: Per-collection cache with full invalidation on document changes.

**Potential Improvements**:
- Incremental index updates instead of full rebuild
- LRU eviction for less-used collections
- Persistent cache with disk-backed storage
- Pre-warming cache on server startup

```python
# Example: LRU cache with max size
from functools import lru_cache

@lru_cache(maxsize=100)  # Limit to 100 collections
def get_bm25_index(collection_id: str, version: int):
    # version changes when documents added/removed
    return build_bm25_index(collection_id)
```

### 2. Embedding Optimization

**Cloud Providers (OpenAI, Voyage, etc.)**:
- Batch queries when possible (bulk embed)
- Cache repeated query embeddings
- Use smaller models for development (text-embedding-3-small)

**Local Providers (Ollama)**:
- Use GPU acceleration if available
- Consider nomic-embed-text for speed vs mxbai-embed-large for quality
- Pre-load model on startup to avoid cold start

```python
# Example: Query embedding cache
from cachetools import TTLCache

query_cache = TTLCache(maxsize=1000, ttl=300)  # 5 min TTL

async def get_query_embedding(query: str) -> list[float]:
    if query in query_cache:
        return query_cache[query]
    embedding = await embed(query)
    query_cache[query] = embedding
    return embedding
```

### 3. Reranker Optimization

**Current**: Reranks top-k results every search.

**Potential Improvements**:
- Skip reranking for high-confidence queries
- Cache rerank scores for repeated queries
- Use lighter model for initial screening (jina-reranker-v1-tiny)
- Batch reranking requests

```python
# Example: Conditional reranking
async def smart_rerank(results, query, threshold=0.85):
    # Skip reranking if top result already high confidence
    if results[0].scores.semantic_score > threshold:
        return results
    return await rerank(results, query)
```

### 4. ChromaDB Optimization

**Query Optimization**:
- Use appropriate `n_results` (don't over-fetch)
- Leverage metadata filtering to reduce search space
- Consider index configuration for large collections

```python
# Example: Efficient filtering
# Good: Filter in ChromaDB
results = collection.query(
    query_embeddings=[embedding],
    where={"collection_id": {"$eq": collection_id}},  # Filter early
    n_results=20
)

# Bad: Filter after retrieval
results = collection.query(
    query_embeddings=[embedding],
    n_results=1000  # Over-fetching
)
filtered = [r for r in results if r.metadata["collection_id"] == collection_id]
```

### 5. Answer Generation Optimization

**Latency Reduction**:
- Use streaming for perceived performance
- GPT-4o-mini for most queries, GPT-4o only when needed
- Local models (Ollama) for privacy-sensitive use cases
- Reduce context window size for faster responses

**Cost Optimization**:
- Limit retrieved chunks passed to LLM
- Truncate very long chunks
- Cache answers for identical queries

```python
# Example: Smart context selection
def select_context(chunks, max_tokens=3000):
    """Select most relevant chunks within token limit."""
    selected = []
    total_tokens = 0
    for chunk in sorted(chunks, key=lambda c: c.score, reverse=True):
        chunk_tokens = len(chunk.content) // 4  # Rough estimate
        if total_tokens + chunk_tokens > max_tokens:
            break
        selected.append(chunk)
        total_tokens += chunk_tokens
    return selected
```

---

## Database Optimization

### PostgreSQL

**Current State**: Single connection, async driver.

**Recommendations**:
- Connection pooling (asyncpg pool)
- Index optimization for search_history table
- Partitioning for large analytics tables
- Regular VACUUM and ANALYZE

```sql
-- Example: Useful indexes
CREATE INDEX idx_search_history_created ON search_history(created_at DESC);
CREATE INDEX idx_search_history_collection ON search_history(collection_id);
CREATE INDEX idx_documents_collection ON documents(collection_id);
```

### ChromaDB

**Current State**: HTTP client, single collection strategy.

**Recommendations**:
- Consider persistent mode for production
- Tune HNSW parameters for larger collections
- Monitor collection sizes

```python
# Example: Production ChromaDB settings
chroma_client = chromadb.HttpClient(
    host=settings.chroma_host,
    port=settings.chroma_port,
    settings=chromadb.Settings(
        chroma_db_impl="duckdb+parquet",
        persist_directory="/data/chroma",
        anonymized_telemetry=False
    )
)
```

---

## Scaling Considerations

### Horizontal Scaling

| Component | Strategy |
|-----------|----------|
| API Servers | Load balancer + multiple instances |
| ChromaDB | Single instance (consider Pinecone/Weaviate for scale) |
| PostgreSQL | Read replicas for analytics |
| BM25 Cache | Redis for shared cache |

### Vertical Scaling (Mac M4 24GB Context)

**Recommended Allocation**:
- Ollama models: 8-12GB
- Jina reranker: 1GB
- BM25 cache: 2-4GB
- Python processes: 2-4GB
- System: 4-8GB

**Ollama Model Selection**:
| Model | VRAM | Quality | Speed |
|-------|------|---------|-------|
| nomic-embed-text | 1GB | Good | Fast |
| mxbai-embed-large | 2GB | Better | Medium |
| llama3.2:3b | 3GB | Good | Fast |
| llama3.1:8b | 8GB | Better | Slow |

---

## Monitoring Recommendations

### Key Metrics to Track

| Metric | Target | Action if Exceeded |
|--------|--------|-------------------|
| Search P95 latency | <500ms | Check reranker, BM25 cache |
| Answer P95 latency | <3s | Check LLM provider |
| Memory usage | <80% | Reduce cache size, restart |
| ChromaDB query time | <100ms | Check collection size |
| Error rate | <1% | Check provider status |

### Logging Strategy

```python
# Example: Performance logging
import time
import logging

logger = logging.getLogger(__name__)

async def search_with_metrics(query: str):
    start = time.perf_counter()

    embed_start = time.perf_counter()
    embedding = await get_embedding(query)
    embed_time = time.perf_counter() - embed_start

    search_start = time.perf_counter()
    results = await hybrid_search(embedding, query)
    search_time = time.perf_counter() - search_start

    total_time = time.perf_counter() - start

    logger.info(
        f"Search metrics: embed={embed_time*1000:.0f}ms, "
        f"search={search_time*1000:.0f}ms, total={total_time*1000:.0f}ms"
    )

    return results
```

---

## Quick Wins Checklist

- [ ] Enable BM25 cache (already implemented)
- [ ] Use GPT-4o-mini instead of GPT-4o for answers
- [ ] Limit context window size to 1-2 chunks
- [ ] Pre-load Jina reranker model on startup
- [ ] Add database indexes for analytics queries
- [ ] Monitor latency percentiles (P50, P95, P99)
- [ ] Set appropriate timeouts for external APIs
- [ ] Use connection pooling for PostgreSQL

---

## Future Optimizations

1. **Async Reranking**: Run reranking in parallel with other operations
2. **Speculative Execution**: Start answer generation before reranking completes
3. **Semantic Caching**: Cache similar query results
4. **Adaptive Top-K**: Dynamically adjust retrieval count based on confidence
5. **Model Distillation**: Use smaller, fine-tuned models for specific tasks
