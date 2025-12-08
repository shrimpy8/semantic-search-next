"""
Services module for core functionality.

Provides initialized instances of core components as FastAPI dependencies.
"""

from app.services.retrieval import (
    DocumentProcessorService,
    VectorStoreService,
    get_document_processor,
    get_vector_store,
)

__all__ = [
    "get_vector_store",
    "get_document_processor",
    "VectorStoreService",
    "DocumentProcessorService",
]
