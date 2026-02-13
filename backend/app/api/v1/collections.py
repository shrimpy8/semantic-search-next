"""
Collections API endpoints.

Provides CRUD operations for document collections following
Stripe-like API design patterns.
"""

import logging
from typing import Protocol, cast
from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.deps import (
    CollectionRepo,
    check_collection_name_unique,
    require_collection,
)
from app.api.schemas import (
    CollectionCreate,
    CollectionListResponse,
    CollectionResponse,
    CollectionUpdate,
    DeletedResponse,
    OperationResult,
)
from app.db.models import Collection
from app.services.retrieval import VectorStoreService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/collections", tags=["collections"])

class _VectorStoreProtocol(Protocol):
    def delete_by_collection_id(self, collection_id: str) -> int: ...


@router.post(
    "",
    response_model=OperationResult[CollectionResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a collection",
    description="Create a new document collection with the given name and settings.",
)
async def create_collection(
    data: CollectionCreate,
    repo: CollectionRepo,
) -> OperationResult[CollectionResponse]:
    """Create a new collection."""
    warnings: list[str] = []

    # Check for duplicate name (DRY helper)
    await check_collection_name_unique(data.name, repo)

    # Check soft limit
    count = await repo.count()
    if count >= 10:
        warnings.append(
            f"You have {count + 1} collections. Consider deleting unused ones."
        )

    # Create collection
    collection = Collection(
        name=data.name,
        description=data.description,
        metadata_=data.metadata,
        settings=data.settings.model_dump(),
        is_trusted=data.is_trusted,
    )
    collection = await repo.create(collection)

    logger.info(f"Created collection: {collection.id} ({collection.name})")

    return OperationResult(
        success=True,
        data=CollectionResponse.from_model(collection),
        message=f"Collection '{data.name}' created successfully",
        warnings=warnings,
    )


@router.get(
    "",
    response_model=CollectionListResponse,
    summary="List collections",
    description="List all collections with cursor-based pagination.",
)
async def list_collections(
    repo: CollectionRepo,
    limit: int = 10,
    starting_after: UUID | None = None,
) -> CollectionListResponse:
    """List all collections with pagination."""
    collections, has_more = await repo.list_with_pagination(
        limit=limit,
        starting_after=starting_after,
    )

    total = await repo.count()

    return CollectionListResponse(
        data=[CollectionResponse.from_model(c) for c in collections],
        has_more=has_more,
        total_count=total,
        next_cursor=str(collections[-1].id) if has_more and collections else None,
    )


@router.get(
    "/{collection_id}",
    response_model=CollectionResponse,
    summary="Get a collection",
    description="Retrieve a single collection by ID.",
)
async def get_collection(
    collection_id: UUID,
    repo: CollectionRepo,
) -> CollectionResponse:
    """Get a collection by ID."""
    # Use DRY helper for 404 check
    await require_collection(collection_id, repo)

    # Update counts
    await repo.update_counts(collection_id)
    collection_refreshed = await repo.get_by_id(collection_id)
    if collection_refreshed is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Collection '{collection_id}' not found",
        )

    return CollectionResponse.from_model(collection_refreshed)


@router.patch(
    "/{collection_id}",
    response_model=CollectionResponse,
    summary="Update a collection",
    description="Update collection properties. Only provided fields are updated.",
)
async def update_collection(
    collection_id: UUID,
    data: CollectionUpdate,
    repo: CollectionRepo,
) -> CollectionResponse:
    """Update a collection."""
    # Use DRY helper for 404 check
    collection = await require_collection(collection_id, repo)

    # Check for duplicate name if name is being changed (DRY helper)
    if data.name and data.name != collection.name:
        await check_collection_name_unique(data.name, repo, exclude_id=collection_id)
        collection.name = data.name

    # Update other fields if provided
    if data.description is not None:
        collection.description = data.description
    if data.metadata is not None:
        collection.metadata_ = data.metadata
    if data.settings is not None:
        collection.settings = data.settings.model_dump()
    if data.is_trusted is not None:
        collection.is_trusted = data.is_trusted

    collection = await repo.update(collection)
    logger.info(f"Updated collection: {collection_id}")

    return CollectionResponse.from_model(collection)


@router.delete(
    "/{collection_id}",
    response_model=DeletedResponse,
    summary="Delete a collection",
    description="Delete a collection and all its documents.",
)
async def delete_collection(
    collection_id: UUID,
    repo: CollectionRepo,
    vector_store: VectorStoreService,
    force: bool = False,
) -> DeletedResponse:
    """
    Delete a collection with transaction safety.

    Order of operations for data integrity:
    1. Validate collection exists
    2. Delete from PostgreSQL FIRST (transactional, can rollback)
    3. Delete from ChromaDB SECOND (if DB delete fails, ChromaDB untouched)

    If ChromaDB delete fails after DB delete, we log a warning but don't fail
    the request - orphaned vectors are less problematic than orphaned DB records.
    """
    # Use DRY helper for 404 check
    collection = await require_collection(collection_id, repo)

    # Check for documents if not forcing
    if not force and collection.document_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Collection has {collection.document_count} documents. Use force=true to delete.",
        )

    # Delete from database FIRST (transactional - will rollback on failure)
    # This ensures we don't have orphaned ChromaDB data if DB delete fails
    await repo.delete(collection)
    logger.info(f"Deleted collection from database: {collection_id}")

    # Delete chunks from ChromaDB SECOND (after DB commit succeeds)
    # If this fails, we log but don't fail - orphaned vectors are acceptable
    try:
        vector_store_typed = cast(_VectorStoreProtocol, vector_store)
        chunks_deleted = vector_store_typed.delete_by_collection_id(str(collection_id))
        logger.info(f"Deleted {chunks_deleted} chunks from vector store for collection: {collection_id}")
    except Exception as e:
        # Log but don't fail - DB record is already deleted
        # Orphaned vectors will be ignored by searches (no matching collection_id in DB)
        logger.warning(
            f"Failed to delete chunks from ChromaDB for collection {collection_id}: {e}. "
            "Orphaned vectors may remain but will be ignored by searches."
        )

    return DeletedResponse(id=collection_id, object="collection")
