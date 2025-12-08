"""
Retrieval Service Module.

Provides initialized instances of VectorStoreManager, DocumentProcessor,
and HybridSearchService as FastAPI dependencies.
Uses singleton pattern for efficient resource management.
"""

import logging
from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from app.config import Settings, get_settings
from app.core.bm25_retriever import BM25Retriever
from app.core.hybrid_retriever import (
    HybridResult,
    HybridRetriever,
    RetrievalMethod,
)
from app.core.reranker import BaseReranker, RerankerFactory

logger = logging.getLogger(__name__)

# Singleton instances
_vector_store_instance = None
_document_processor_instance = None
_hybrid_search_service_instance = None


def _create_vector_store(settings: Settings):
    """
    Create VectorStoreManager instance.

    Uses ChromaDB in Docker mode connecting to the configured host/port.
    """
    from app.core.vector_store import VectorStoreManager

    logger.info(
        f"Initializing VectorStoreManager: "
        f"host={settings.chroma_host}, port={settings.chroma_port}, "
        f"embedding={settings.embedding_model}"
    )

    return VectorStoreManager(
        embedding_model_name=settings.embedding_model,
        collection_name="semantic_search_docs",
        use_docker=True,
        chroma_host=settings.chroma_host,
        chroma_port=settings.chroma_port,
        openai_api_key=settings.openai_api_key,
    )


def _create_document_processor(settings: Settings):
    """
    Create DocumentProcessor instance.

    Uses configured chunk size and overlap settings.
    """
    from app.core.document_processor import DocumentProcessor

    logger.info(
        f"Initializing DocumentProcessor: "
        f"chunk_size={settings.chunk_size}, overlap={settings.chunk_overlap}"
    )

    return DocumentProcessor(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        add_start_index=True,
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


@lru_cache
def get_document_processor():
    """
    Get or create singleton DocumentProcessor instance.

    Returns:
        DocumentProcessor instance for chunking documents
    """
    global _document_processor_instance

    if _document_processor_instance is None:
        settings = get_settings()
        _document_processor_instance = _create_document_processor(settings)
        logger.info("DocumentProcessor initialized successfully")

    return _document_processor_instance


# Type aliases for FastAPI dependencies
VectorStoreService = Annotated[object, Depends(get_vector_store)]
DocumentProcessorService = Annotated[object, Depends(get_document_processor)]


class HybridSearchService:
    """
    Service for hybrid search with BM25 + semantic search and reranking.

    Manages per-collection BM25 indices and provides unified search interface.
    """

    def __init__(self, vector_store, settings: Settings):
        self.vector_store = vector_store
        self.settings = settings
        self._bm25_indices: dict[str, BM25Retriever] = {}
        self._reranker: BaseReranker | None = None
        self._reranker_initialized = False

        logger.info("HybridSearchService initialized")

    def _get_reranker(self) -> BaseReranker | None:
        """Lazily initialize reranker."""
        if not self._reranker_initialized:
            self._reranker_initialized = True
            if self.settings.use_reranking:
                if self.settings.reranker_provider == "auto":
                    self._reranker = RerankerFactory.get_available_reranker()
                else:
                    try:
                        self._reranker = RerankerFactory.create(self.settings.reranker_provider)
                        if not self._reranker.is_available():
                            logger.warning(f"Reranker {self.settings.reranker_provider} not available")
                            self._reranker = None
                    except Exception as e:
                        logger.error(f"Failed to create reranker: {e}")
                        self._reranker = None
        return self._reranker

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

    def invalidate_bm25_cache(self, collection_id: str = None):
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
        document_ids: list[str] | None = None,
        k: int = 5,
        method: str = "hybrid",
        alpha: float = 0.5,
        use_reranker: bool = True,
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

        Returns:
            List of HybridResult with scores
        """
        # Build filter for ChromaDB
        filter_dict = None
        if collection_id or document_ids:
            conditions = []
            if collection_id:
                conditions.append({"collection_id": {"$eq": collection_id}})
            if document_ids:
                if len(document_ids) == 1:
                    conditions.append({"document_id": {"$eq": document_ids[0]}})
                else:
                    conditions.append({"document_id": {"$in": document_ids}})

            if len(conditions) == 1:
                filter_dict = conditions[0]
            else:
                filter_dict = {"$and": conditions}

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

        # Create hybrid retriever
        reranker = self._get_reranker() if use_reranker else None

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

        return results

    def get_stats(self) -> dict:
        """Get service statistics."""
        reranker = self._get_reranker()
        return {
            "bm25_cached_collections": len(self._bm25_indices),
            "reranker_available": reranker.is_available() if reranker else False,
            "reranker_type": type(reranker).__name__ if reranker else None,
            "use_reranking": self.settings.use_reranking,
            "default_method": self.settings.default_retrieval_method,
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
    global _vector_store_instance, _document_processor_instance, _hybrid_search_service_instance
    _vector_store_instance = None
    _document_processor_instance = None
    _hybrid_search_service_instance = None
    get_vector_store.cache_clear()
    get_document_processor.cache_clear()
    logger.info("Services reset")
