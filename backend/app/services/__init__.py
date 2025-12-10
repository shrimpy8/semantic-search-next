"""
Services module for core functionality.

Provides initialized instances of core components as FastAPI dependencies.
"""

from app.services.retrieval import (
    HybridSearchService,
    VectorStoreService,
    get_hybrid_search_service,
    get_vector_store,
)

__all__ = [
    "get_vector_store",
    "get_hybrid_search_service",
    "VectorStoreService",
    "HybridSearchService",
]
