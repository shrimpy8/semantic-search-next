"""
Search API endpoints.

Provides semantic search across collections with hybrid retrieval.
"""

import logging
import re
import time
from typing import Protocol, TypedDict, cast
from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.deps import (
    CollectionRepo,
    DbSession,
    DocumentRepo,
    SettingsRepo,
    require_collection,
)
from app.api.schemas import (
    AnswerVerificationSchema,
    CitationSchema,
    SearchRequest,
    SearchResponse,
    SearchResultSchema,
    SearchScoresSchema,
)
from app.config import get_settings
from app.core.answer_verifier import AnswerVerifier
from app.core.qa_chain import QAChain
from app.db.models import SearchQuery
from app.services.retrieval import HybridSearchServiceDep, VectorStoreService

logger = logging.getLogger(__name__)

class _PresetConfig(TypedDict):
    alpha: float
    top_k_multiplier: float
    use_reranker: bool


class _VectorStoreProtocol(Protocol):
    def get_chunks_by_document(self, document_id: str) -> list: ...


def _extract_section(content: str) -> str | None:
    """Extract section heading from content if present."""
    # Match markdown headings (# Heading, ## Heading, etc.)
    match = re.match(r'^#{1,6}\s+(.+?)(?:\n|$)', content.strip())
    if match:
        return match.group(1).strip()
    return None


def _calculate_relevance_percent(final_score: float, max_final_score: float | None = None) -> int:
    """
    Convert final_score to 0-100% relevance display value.

    When reranking is used, final_score is the rerank score (0-1).
    When reranking is not used, final_score is the RRF fusion score (typically small values).

    We use the final_score directly when it appears to be from reranking (0-1 range),
    otherwise we scale up small RRF scores to be more meaningful.
    """
    if final_score <= 0:
        return 0

    # If score looks like rerank score (0-1 range), use it directly
    if final_score <= 1.0:
        # If max_final_score is provided (non-reranked), normalize for display
        if max_final_score and max_final_score > 0 and max_final_score <= 1.0:
            return int((final_score / max_final_score) * 100)
        return int(final_score * 100)
    else:
        # Shouldn't happen with reranking, but cap at 100
        return 100


def _build_answer_context(results: list[SearchResultSchema], max_sources: int = 3) -> tuple[str, list[str]]:
    """
    Build answer context from top results, including adjacent chunks when available.

    Returns:
        Tuple of (context_text, source_names)
    """
    selected = results[:max_sources]
    if not selected:
        return "", []

    seen_blocks: set[str] = set()
    context_blocks: list[str] = []
    source_names = [r.document_name for r in selected]

    for i, r in enumerate(selected):
        parts: list[str] = []
        if r.context_before:
            parts.append(r.context_before)
        parts.append(r.content)
        if r.context_after:
            parts.append(r.context_after)

        combined = "\n\n".join(p for p in parts if p)
        if combined and combined not in seen_blocks:
            seen_blocks.add(combined)
            context_blocks.append(f"[Source {i}] {r.document_name}\n{combined}")

    return "\n\n---\n\n".join(context_blocks), source_names


def _get_adjacent_from_chunks(
    chunks: list,
    chunk_index: int,
    before: int,
    after: int,
) -> dict[str, list]:
    """Compute adjacent chunks from a cached list of chunks."""
    if not chunks:
        return {"before": [], "after": []}

    chunks_sorted = sorted(
        chunks,
        key=lambda c: c.metadata.get("chunk_index", 0)
    )

    index_to_chunk = {
        c.metadata.get("chunk_index", i): c
        for i, c in enumerate(chunks_sorted)
    }

    before_chunks = []
    for i in range(chunk_index - before, chunk_index):
        if i >= 0 and i in index_to_chunk:
            before_chunks.append(index_to_chunk[i])

    after_chunks = []
    for i in range(chunk_index + 1, chunk_index + after + 1):
        if i in index_to_chunk:
            after_chunks.append(index_to_chunk[i])

    return {"before": before_chunks, "after": after_chunks}

router = APIRouter(prefix="/search", tags=["search"])


# Preset configurations for different retrieval modes
PRESET_CONFIGS: dict[str, _PresetConfig] = {
    "high_precision": {
        "alpha": 0.85,       # Heavy semantic weight for precision
        "top_k_multiplier": 1.0,  # Fewer results, more precise
        "use_reranker": True,     # Always rerank for precision
    },
    "balanced": {
        "alpha": 0.5,        # Equal weight semantic and keyword
        "top_k_multiplier": 1.0,
        "use_reranker": True,
    },
    "high_recall": {
        "alpha": 0.3,        # More keyword weight for recall
        "top_k_multiplier": 2.0,  # Fetch more results
        "use_reranker": True,     # Rerank to sort the larger set
    },
}


@router.post(
    "",
    response_model=SearchResponse,
    summary="Execute a search",
    description="Search across documents using hybrid retrieval (semantic + BM25) with reranking.",
)
async def search(
    request: SearchRequest,
    db: DbSession,
    collection_repo: CollectionRepo,
    document_repo: DocumentRepo,
    settings_repo: SettingsRepo,
    hybrid_search: HybridSearchServiceDep,
    vector_store: VectorStoreService,
) -> SearchResponse:
    """Execute a search query using hybrid retrieval."""
    start_time = time.perf_counter()
    vector_store_typed = cast(_VectorStoreProtocol, vector_store)

    # Get database settings for defaults
    db_settings = await settings_repo.get()

    # Determine preset
    preset = request.preset or db_settings.default_preset

    # Get base top_k from request or settings
    base_top_k = request.top_k if request.top_k is not None else db_settings.default_top_k

    # Apply preset-specific configurations OR use custom values
    if preset in PRESET_CONFIGS and request.alpha is None:
        # Using a preset - apply preset-specific parameters
        preset_config = PRESET_CONFIGS[preset]
        alpha = preset_config["alpha"]
        use_reranker = preset_config["use_reranker"]
        top_k = int(base_top_k * preset_config["top_k_multiplier"])
    else:
        # Custom mode or explicit alpha provided - use request/DB values
        alpha = request.alpha if request.alpha is not None else db_settings.default_alpha
        use_reranker = request.use_reranker if request.use_reranker is not None else db_settings.default_use_reranker
        top_k = base_top_k

    # Validate collection if specified (DRY helper)
    collection_name = None
    if request.collection_id:
        collection = await require_collection(request.collection_id, collection_repo)
        collection_name = collection.name

    # Validate query is not empty (avoid wasted API calls)
    if not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query cannot be empty",
        )

    # Execute hybrid search with reranking
    try:
        hybrid_results = hybrid_search.search(
            query=request.query,
            collection_id=str(request.collection_id) if request.collection_id else None,
            document_ids=[str(d) for d in request.document_ids] if request.document_ids else None,
            k=top_k,
            method=preset,
            alpha=alpha,
            use_reranker=use_reranker,
            reranker_provider=db_settings.reranker_provider,
        )
    except Exception as e:
        logger.error(f"Search failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search operation failed: {str(e)}",
        )

    # Determine if reranking was applied (affects confidence thresholds/display)
    rerank_used = any(hr.rerank_score is not None for hr in hybrid_results)
    max_final_score = None
    if not rerank_used:
        max_final_score = max((hr.final_score for hr in hybrid_results), default=0.0)

    # Convert to API response format
    results: list[SearchResultSchema] = []

    # Find max scores for normalization (to make relative comparisons meaningful)
    max_bm25 = max((hr.bm25_score for hr in hybrid_results if hr.bm25_score is not None), default=1.0)
    max_semantic = max((hr.semantic_score for hr in hybrid_results if hr.semantic_score is not None), default=1.0)
    if max_bm25 <= 0:
        max_bm25 = 1.0
    if max_semantic <= 0:
        max_semantic = 1.0

    # Cache chunks per document for context expansion
    doc_chunks_cache: dict[str, list] = {}

    for i, hr in enumerate(hybrid_results):
        doc = hr.document
        metadata = doc.metadata or {}
        doc_id = metadata.get("document_id", "")
        coll_id = metadata.get("collection_id", "")

        # Get document/collection names from metadata or lookup
        doc_name = metadata.get("source", "Unknown")
        coll_name_from_meta = metadata.get("collection_name", collection_name or "Unknown")

        # Extract section heading if present
        section = _extract_section(doc.page_content)

        # Calculate relevance percentage from final_score (rerank=0-1, RRF=small values)
        relevance_percent = _calculate_relevance_percent(
            hr.final_score,
            max_final_score=max_final_score if not rerank_used else None,
        )

        # Normalize BM25 score to 0-1 for display (original is unbounded)
        # No artificial floor - show actual normalized score for transparency
        normalized_bm25 = None
        if hr.bm25_score is not None:
            normalized_bm25 = min(hr.bm25_score / max_bm25, 1.0) if max_bm25 > 0 else 0.0

        # Semantic score is already 0-1, pass through as-is
        normalized_semantic = hr.semantic_score

        # Extract chunk position for context expansion (P2)
        chunk_index = metadata.get("chunk_index")
        total_chunks = metadata.get("total_chunks")

        # Fetch adjacent chunks for context expansion using settings
        context_before = None
        context_after = None
        context_window = db_settings.context_window_size
        if doc_id and chunk_index is not None and context_window > 0:
            try:
                if doc_id not in doc_chunks_cache:
                    doc_chunks_cache[doc_id] = vector_store_typed.get_chunks_by_document(doc_id)

                adjacent = _get_adjacent_from_chunks(
                    chunks=doc_chunks_cache.get(doc_id, []),
                    chunk_index=chunk_index,
                    before=context_window,
                    after=context_window,
                )
                # Combine all before chunks into single context string
                if adjacent.get("before"):
                    context_before = "\n\n".join(
                        chunk.page_content for chunk in adjacent["before"]
                    )
                # Combine all after chunks into single context string
                if adjacent.get("after"):
                    context_after = "\n\n".join(
                        chunk.page_content for chunk in adjacent["after"]
                    )
            except Exception as e:
                logger.warning(f"Failed to fetch context for chunk {i}: {e}")

        results.append(SearchResultSchema(
            id=f"chunk_{i}",
            document_id=UUID(doc_id) if doc_id else UUID("00000000-0000-0000-0000-000000000000"),
            document_name=doc_name,
            collection_id=UUID(coll_id) if coll_id else UUID("00000000-0000-0000-0000-000000000000"),
            collection_name=coll_name_from_meta,
            content=doc.page_content,
            page=metadata.get("page"),
            section=section,
            verified=True,  # Always true - result came from indexed document
            scores=SearchScoresSchema(
                semantic_score=normalized_semantic,  # Use normalized version with 5% floor
                bm25_score=normalized_bm25,
                rerank_score=hr.rerank_score,
                final_score=hr.final_score,
                relevance_percent=relevance_percent,
            ),
            metadata={
                k: v for k, v in metadata.items()
                if k not in ["document_id", "collection_id", "source", "page", "chunk_index", "total_chunks"]
            } | {"retrieval_method": hr.retrieval_method},
            # Context expansion fields (P2)
            context_before=context_before,
            context_after=context_after,
            chunk_index=chunk_index,
            total_chunks=total_chunks,
        ))

    # Get threshold from settings (scale if reranking was not used and scores are small)
    min_threshold = db_settings.min_score_threshold
    if not rerank_used and max_final_score and max_final_score > 0:
        # Only scale when scores are smaller than the configured threshold
        if max_final_score < min_threshold:
            min_threshold = min_threshold * max_final_score

    # Separate high and low confidence results based on final_score threshold
    high_confidence_results: list[SearchResultSchema] = []
    low_confidence_results: list[SearchResultSchema] = []

    for result in results:
        if result.scores.final_score >= min_threshold:
            high_confidence_results.append(result)
        else:
            low_confidence_results.append(result)

    # Calculate latency
    latency_ms = int((time.perf_counter() - start_time) * 1000)

    # Prepare retrieved chunks data for evaluation storage
    # Store all results (both high and low confidence) for comprehensive evaluation
    all_results = high_confidence_results + low_confidence_results
    retrieved_chunks_data = [
        {
            "chunk_id": r.id,
            "document_id": str(r.document_id),
            "document_name": r.document_name,
            "collection_id": str(r.collection_id),
            "content": r.content,
            "page": r.page,
            "section": r.section,
            "scores": {
                "semantic_score": r.scores.semantic_score,
                "bm25_score": r.scores.bm25_score,
                "rerank_score": r.scores.rerank_score,
                "final_score": r.scores.final_score,
                "relevance_percent": r.scores.relevance_percent,
            },
            "chunk_index": r.chunk_index,
            "total_chunks": r.total_chunks,
        }
        for r in all_results
    ]

    # Log search query for analytics with evaluation data
    search_log = SearchQuery(
        query_text=request.query,
        collection_id=request.collection_id,
        retrieval_method=preset,
        results_count=len(high_confidence_results),
        latency_ms=latency_ms,
        # Evaluation data capture
        retrieved_chunks=retrieved_chunks_data,
    )
    db.add(search_log)

    # Generate RAG answer if requested and we have results
    answer = None
    answer_verification = None
    answer_model_used = None
    if request.generate_answer and high_confidence_results:
        try:
            # Get answer provider/model from DB settings
            answer_provider = db_settings.answer_provider
            answer_model_used = db_settings.answer_model
            # Get answer style and map to prompt key
            answer_style = getattr(db_settings, 'answer_style', 'balanced')
            prompt_key = f"qa_{answer_style}"  # qa_concise, qa_balanced, or qa_detailed

            # Build context from top results (include adjacent chunks if available)
            context_docs, source_names = _build_answer_context(high_confidence_results, max_sources=3)

            # Initialize QA chain with provider and prompt style from settings
            qa_chain = QAChain(
                provider=answer_provider,
                model_name=answer_model_used,
                temperature=0.0,
                prompt_key=prompt_key,
            )
            answer = qa_chain.generate_answer(
                question=request.query,
                context=context_docs,
            )
            logger.info(f"RAG answer generated: {len(answer)} characters using {answer_provider}/{answer_model_used}")

            # Verify the answer against source documents
            # Note: verifier still uses OpenAI for now (can be extended later)
            try:
                app_settings = get_settings()
                verifier = AnswerVerifier(model_name="gpt-4o-mini", temperature=0.0, api_key=app_settings.openai_api_key)
                verification_result = verifier.verify(
                    answer=answer,
                    context=context_docs,
                    sources=source_names,
                )

                # Convert to schema
                answer_verification = AnswerVerificationSchema(
                    confidence=verification_result.confidence,
                    citations=[
                        CitationSchema(
                            claim=c.claim,
                            source_index=c.source_index,
                            source_name=c.source_name,
                            quote=c.quote,
                            verified=c.verified,
                        )
                        for c in verification_result.citations
                    ],
                    warning=verification_result.warning,
                    verified_claims=verification_result.verified_claims,
                    total_claims=verification_result.total_claims,
                    coverage_percent=verification_result.coverage_percent,
                )
                logger.info(
                    f"Answer verification: confidence={verification_result.confidence} "
                    f"coverage={verification_result.coverage_percent}%"
                )
            except Exception as e:
                logger.error(f"Answer verification failed: {e}", exc_info=True)
                # Don't fail - just return without verification
        except Exception as e:
            logger.error(f"RAG answer generation failed: {e}", exc_info=True)
            # Don't fail the request - just return without answer

    # Calculate final latency (includes RAG if generated)
    latency_ms = int((time.perf_counter() - start_time) * 1000)

    # Update search log with generated answer and sources for evaluation
    if answer:
        search_log.generated_answer = answer
        search_log.answer_sources = {
            "sources": [r.document_name for r in high_confidence_results[:3]],
            "verification": {
                "confidence": answer_verification.confidence if answer_verification else None,
                "verified_claims": answer_verification.verified_claims if answer_verification else None,
                "total_claims": answer_verification.total_claims if answer_verification else None,
                "coverage_percent": answer_verification.coverage_percent if answer_verification else None,
            } if answer_verification else None,
        }

    # Update latency now that we know the full duration
    search_log.latency_ms = latency_ms

    logger.info(
        f"Search completed: query='{request.query[:50]}' "
        f"results={len(high_confidence_results)} low_confidence={len(low_confidence_results)} "
        f"latency={latency_ms}ms preset={preset} alpha={alpha:.2f} top_k={top_k} reranker={use_reranker} "
        f"rag={'yes' if answer else 'no'}"
    )

    return SearchResponse(
        query=request.query,
        results=high_confidence_results,
        low_confidence_results=low_confidence_results,
        low_confidence_count=len(low_confidence_results),
        min_score_threshold=min_threshold,
        answer=answer,
        answer_verification=answer_verification,
        sources=[r.document_name for r in high_confidence_results[:3]],
        latency_ms=latency_ms,
        retrieval_method=preset,
        # Search configuration for evaluation capture
        search_alpha=alpha,
        search_use_reranker=use_reranker,
        reranker_provider=db_settings.reranker_provider,
        chunk_size=db_settings.chunk_size,
        chunk_overlap=db_settings.chunk_overlap,
        embedding_model=db_settings.embedding_model,
        answer_model=answer_model_used,
    )
