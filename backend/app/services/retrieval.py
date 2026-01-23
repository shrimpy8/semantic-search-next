"""
Retrieval Service Module.

Provides initialized instances of VectorStoreManager and HybridSearchService
as FastAPI dependencies. Uses singleton pattern for efficient resource management.

Configuration Hierarchy:
-----------------------
- Infrastructure settings (ChromaDB host/port, API keys): from config.py (.env)
- User-configurable settings (embedding model, chunk size, reranker): from DB Settings

Note: The embedding model is loaded from DB settings at startup. Changing the embedding
model in settings requires a server restart since existing documents are already embedded
with the original model. This is by design - embedding model changes require re-indexing.
"""

import logging
import os
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from uuid import UUID

from app.config import Settings, get_settings
from app.core.bm25_retriever import BM25Retriever
from app.core.chroma_filters import build_chromadb_filter
from app.core.hybrid_retriever import (
    HybridResult,
    HybridRetriever,
    RetrievalMethod,
)
from app.core.reranker import BaseReranker, RerankerFactory

logger = logging.getLogger(__name__)

# =============================================================================
# Injection Detection (Observability-Only)
# Safe import with graceful fallback - detection is optional
# =============================================================================
_injection_detector = None
try:
    from app.core.injection_detector import InjectionDetector
    _injection_detector = InjectionDetector()
    logger.info("Injection detector initialized (observability mode)")
except Exception as e:
    logger.warning(f"Injection detector not available: {e}")

# Singleton instances
_vector_store_instance = None
_hybrid_search_service_instance = None

# Default embedding model (can be overridden by DB settings at startup)
# This is read once at startup from DB Settings and cached
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-large"


def _get_initial_embedding_model() -> str:
    """
    Get the embedding model from DB Settings at startup.

    This is called once during VectorStore initialization to determine
    which embedding model to use. Since changing embedding models requires
    re-indexing all documents, this is intentionally not dynamic.

    Falls back to DEFAULT_EMBEDDING_MODEL if DB is not available.
    """
    try:
        # Try to get from environment variable override first
        env_model = os.getenv("EMBEDDING_MODEL")
        if env_model:
            logger.info(f"Using embedding model from EMBEDDING_MODEL env var: {env_model}")
            return env_model

        # Try to get from DB settings synchronously for startup
        # This is a bit hacky but necessary since we need to initialize
        # before the async context is available
        from sqlalchemy import create_engine, select
        from sqlalchemy.orm import Session

        settings = get_settings()
        engine = create_engine(settings.database_url_sync)

        with Session(engine) as session:
            from app.db.models import Settings as DbSettings
            stmt = select(DbSettings).where(DbSettings.key == "global")
            db_settings = session.execute(stmt).scalar_one_or_none()

            if db_settings:
                logger.info(f"Using embedding model from DB settings: {db_settings.embedding_model}")
                return db_settings.embedding_model

    except Exception as e:
        logger.warning(f"Could not load embedding model from DB settings: {e}")

    logger.info(f"Using default embedding model: {DEFAULT_EMBEDDING_MODEL}")
    return DEFAULT_EMBEDDING_MODEL


def _create_vector_store(settings: Settings):
    """
    Create VectorStoreManager instance.

    Uses ChromaDB in Docker mode connecting to the configured host/port.
    The embedding model is loaded from DB settings at startup.
    """
    from app.core.vector_store import VectorStoreManager

    embedding_model = _get_initial_embedding_model()

    logger.info(
        f"Initializing VectorStoreManager: "
        f"host={settings.chroma_host}, port={settings.chroma_port}, "
        f"embedding={embedding_model}"
    )

    return VectorStoreManager(
        embedding_model_name=embedding_model,
        collection_name="semantic_search_docs",
        use_docker=True,
        chroma_host=settings.chroma_host,
        chroma_port=settings.chroma_port,
        openai_api_key=settings.openai_api_key,
        ollama_base_url=settings.ollama_base_url,
    )


@lru_cache
def get_vector_store():
    """
    Get or create singleton VectorStoreManager instance.

    Returns:
        VectorStoreManager instance connected to ChromaDB
    """
    global _vector_store_instance

    if _vector_store_instance is None:
        settings = get_settings()
        try:
            _vector_store_instance = _create_vector_store(settings)
            logger.info("VectorStoreManager initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize VectorStoreManager: {e}")
            raise

    return _vector_store_instance


# Type aliases for FastAPI dependencies
VectorStoreService = Annotated[object, Depends(get_vector_store)]


class HybridSearchService:
    """
    Service for hybrid search with BM25 + semantic search and reranking.

    Manages per-collection BM25 indices and provides unified search interface.

    Note: Reranker provider is now configured per-request based on DB settings,
    passed from the API endpoint rather than stored in the service.
    """

    def __init__(self, vector_store, settings: Settings):
        self.vector_store = vector_store
        self.settings = settings  # Infrastructure settings (API keys, URLs)
        self._bm25_indices: dict[str, BM25Retriever] = {}
        self._rerankers: dict[str, BaseReranker] = {}  # Cache rerankers by provider

        logger.info("HybridSearchService initialized")

    def _get_reranker(self, provider: str = "auto") -> BaseReranker | None:
        """
        Get or create a reranker instance for the given provider.

        Args:
            provider: Reranker provider name ("auto", "jina", "cohere")

        Returns:
            Reranker instance or None if not available
        """
        # Check cache first
        if provider in self._rerankers:
            return self._rerankers[provider]

        # Create reranker
        try:
            if provider == "auto":
                reranker = RerankerFactory.get_available_reranker()
            else:
                reranker = RerankerFactory.create(provider)
                if not reranker.is_available():
                    logger.warning(f"Reranker {provider} not available")
                    reranker = None

            # Cache for future use
            if reranker:
                self._rerankers[provider] = reranker
                logger.info(f"Created reranker: {provider} -> {type(reranker).__name__}")

            return reranker

        except Exception as e:
            logger.error(f"Failed to create reranker {provider}: {e}")
            return None

    def _get_bm25_index(self, collection_id: str | None = None) -> BM25Retriever:
        """Get or create BM25 index for a collection or all collections."""
        # Use special key for global index
        cache_key = collection_id if collection_id else "__all__"

        if cache_key not in self._bm25_indices:
            # Load documents from ChromaDB
            docs = self.vector_store.get_all_documents(collection_id=collection_id)

            bm25 = BM25Retriever()
            if docs:
                bm25.index_documents(docs)
                if collection_id:
                    logger.info(f"Built BM25 index for collection {collection_id}: {len(docs)} docs")
                else:
                    logger.info(f"Built global BM25 index: {len(docs)} docs")
            else:
                if collection_id:
                    logger.warning(f"No documents found for collection {collection_id}")
                else:
                    logger.warning("No documents found for global BM25 index")

            self._bm25_indices[cache_key] = bm25

        return self._bm25_indices[cache_key]

    def invalidate_bm25_cache(self, collection_id: str | None = None):
        """Invalidate BM25 cache for a collection or all collections."""
        if collection_id:
            self._bm25_indices.pop(collection_id, None)
            # Also invalidate global cache since collection data changed
            self._bm25_indices.pop("__all__", None)
            logger.info(f"Invalidated BM25 cache for collection {collection_id} and global cache")
        else:
            self._bm25_indices.clear()
            logger.info("Invalidated all BM25 caches")

    def search(
        self,
        query: str,
        collection_id: str | None = None,
        document_ids: list[UUID | str] | None = None,
        k: int = 5,
        method: str = "hybrid",
        alpha: float = 0.5,
        use_reranker: bool = True,
        reranker_provider: str = "auto",
    ) -> list[HybridResult]:
        """
        Execute hybrid search with optional reranking.

        Args:
            query: Search query text
            collection_id: Optional collection to search within
            document_ids: Optional list of document IDs to search within
            k: Number of results to return
            method: Retrieval method ("semantic", "bm25", "hybrid")
            alpha: Weight for semantic search in hybrid mode (0-1)
            use_reranker: Whether to apply reranking
            reranker_provider: Reranker provider ("auto", "jina", "cohere")

        Returns:
            List of HybridResult with scores
        """
        # Build filter for ChromaDB
        filter_dict = build_chromadb_filter(collection_id, document_ids)

        # Get semantic retriever with filter
        semantic_retriever = self.vector_store.get_retriever(
            search_k=k * 3,  # Fetch more for fusion
            filter=filter_dict
        )

        # Map presets to retrieval methods
        preset_to_method = {
            "high_precision": "semantic",  # Pure semantic search
            "balanced": "hybrid",           # BM25 + semantic fusion
            "high_recall": "hybrid",        # Hybrid with more results
        }
        actual_method = preset_to_method.get(method, method)
        retrieval_method = RetrievalMethod(actual_method) if actual_method in ["semantic", "bm25", "hybrid"] else RetrievalMethod.HYBRID

        logger.info(f"Search: method={method} -> actual_method={actual_method}, retrieval_method={retrieval_method.value}")

        # Get BM25 index for hybrid/bm25 search (supports global search when collection_id is None)
        bm25_docs = []
        if retrieval_method != RetrievalMethod.SEMANTIC:
            # Get BM25 index (will use global index if collection_id is None)
            bm25_retriever = self._get_bm25_index(collection_id)
            scope = f"collection {collection_id}" if collection_id else "all collections"
            logger.info(f"BM25 retriever for {scope}: indexed={bm25_retriever.is_indexed()}, doc_count={len(bm25_retriever.documents)}")
            if bm25_retriever.is_indexed():
                # Get documents for the hybrid retriever
                bm25_docs = bm25_retriever.documents
                logger.info(f"Passing {len(bm25_docs)} docs to HybridRetriever")

            # If document_ids are provided, filter BM25 docs to the requested scope
            if document_ids and bm25_docs:
                allowed_ids = set(document_ids)
                before_count = len(bm25_docs)
                bm25_docs = [
                    doc for doc in bm25_docs
                    if doc.metadata and doc.metadata.get("document_id") in allowed_ids
                ]
                logger.info(
                    f"Filtered BM25 docs by document_ids: {before_count} -> {len(bm25_docs)}"
                )

        # Create hybrid retriever
        reranker = self._get_reranker(reranker_provider) if use_reranker else None

        hybrid_retriever = HybridRetriever(
            semantic_retriever=semantic_retriever,
            documents=bm25_docs if bm25_docs else None,
            reranker=reranker,
            alpha=alpha,
        )

        # Execute search
        results = hybrid_retriever.retrieve(
            query=query,
            k=k,
            method=retrieval_method,
            use_reranker=use_reranker and reranker is not None,
        )

        # =================================================================
        # Injection Detection (Observability-Only)
        # This block ONLY logs - it never modifies or blocks results
        # Disable via ENABLE_INJECTION_DETECTION=false in .env
        # =================================================================
        if _injection_detector and self.settings.enable_injection_detection:
            try:
                # Scan query (user input)
                query_scan = _injection_detector.scan_text(query)
                if query_scan.detected:
                    logger.warning(
                        f"[INJECTION_DETECT] Query flagged: "
                        f"patterns={query_scan.patterns}, score={query_scan.score:.2f}, "
                        f"query='{query[:100]}...'"
                    )

                # Scan retrieved chunks (document content)
                chunk_texts = [r.document.page_content for r in results if r.document]
                if chunk_texts:
                    chunk_results = _injection_detector.scan_texts(chunk_texts)
                    summary = _injection_detector.get_summary(chunk_results)
                    if summary["total_detected"] > 0:
                        logger.warning(
                            f"[INJECTION_DETECT] Chunks flagged: "
                            f"{summary['total_detected']}/{summary['total_scanned']} chunks, "
                            f"categories={summary['categories_found']}, "
                            f"max_score={summary['max_score']:.2f}"
                        )
            except Exception as e:
                # Detection errors should NEVER break search
                logger.error(f"[INJECTION_DETECT] Detection failed (non-blocking): {e}")

        return results

    def get_stats(self) -> dict:
        """Get service statistics."""
        # Get any cached reranker to show availability
        auto_reranker = self._get_reranker("auto")
        return {
            "bm25_cached_collections": len(self._bm25_indices),
            "reranker_available": auto_reranker.is_available() if auto_reranker else False,
            "reranker_type": type(auto_reranker).__name__ if auto_reranker else None,
            "cached_rerankers": list(self._rerankers.keys()),
        }


def get_hybrid_search_service():
    """
    Get or create singleton HybridSearchService instance.

    Returns:
        HybridSearchService instance for hybrid retrieval
    """
    global _hybrid_search_service_instance

    if _hybrid_search_service_instance is None:
        vector_store = get_vector_store()
        settings = get_settings()
        _hybrid_search_service_instance = HybridSearchService(vector_store, settings)
        logger.info("HybridSearchService initialized successfully")

    return _hybrid_search_service_instance


# Type aliases for FastAPI dependencies
HybridSearchServiceDep = Annotated[HybridSearchService, Depends(get_hybrid_search_service)]


def reset_services():
    """
    Reset singleton instances (useful for testing).
    """
    global _vector_store_instance, _hybrid_search_service_instance
    _vector_store_instance = None
    _hybrid_search_service_instance = None
    get_vector_store.cache_clear()
    logger.info("Services reset")
