"""
Data models for collection management.

This module provides type-safe dataclasses for collections, documents,
and search operations following Stripe-like API design principles.
"""

from app.models.collection import Collection, CollectionSettings
from app.models.document import Document, DocumentStatus
from app.models.errors import (
    APIError,
    DuplicateError,
    LimitExceededError,
    NotFoundError,
    ValidationError,
)
from app.models.responses import DeletedResponse, ListResponse
from app.models.search import (
    RetrievalMethod,
    SearchRequest,
    SearchResponse,
    SearchResult,
    SearchScores,
)

__all__ = [
    # Errors
    "APIError",
    "ValidationError",
    "NotFoundError",
    "DuplicateError",
    "LimitExceededError",
    # Collection
    "Collection",
    "CollectionSettings",
    # Document
    "Document",
    "DocumentStatus",
    # Search
    "SearchRequest",
    "SearchResult",
    "SearchScores",
    "SearchResponse",
    "RetrievalMethod",
    # Responses
    "ListResponse",
    "DeletedResponse",
]
