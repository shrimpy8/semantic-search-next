"""
FastAPI dependencies for dependency injection.

Provides database sessions and repository instances to endpoints.
"""

from collections.abc import AsyncGenerator
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import CollectionRepository, DocumentRepository, SettingsRepository, get_db
from app.db.models import Collection, Document


async def get_collection_repo(
    session: AsyncSession = Depends(get_db),
) -> AsyncGenerator[CollectionRepository, None]:
    """Dependency that provides a CollectionRepository."""
    yield CollectionRepository(session)


async def get_document_repo(
    session: AsyncSession = Depends(get_db),
) -> AsyncGenerator[DocumentRepository, None]:
    """Dependency that provides a DocumentRepository."""
    yield DocumentRepository(session)


async def get_settings_repo(
    session: AsyncSession = Depends(get_db),
) -> AsyncGenerator[SettingsRepository, None]:
    """Dependency that provides a SettingsRepository."""
    yield SettingsRepository(session)


# Type aliases for cleaner endpoint signatures
DbSession = Annotated[AsyncSession, Depends(get_db)]
CollectionRepo = Annotated[CollectionRepository, Depends(get_collection_repo)]
DocumentRepo = Annotated[DocumentRepository, Depends(get_document_repo)]
SettingsRepo = Annotated[SettingsRepository, Depends(get_settings_repo)]


# ============================================================================
# Helper functions to avoid DRY violations
# ============================================================================


async def require_collection(
    collection_id: UUID,
    repo: CollectionRepository,
) -> Collection:
    """
    Get a collection by ID or raise 404.

    DRY helper to avoid repeating this check in every endpoint.
    """
    collection = await repo.get_by_id(collection_id)
    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Collection '{collection_id}' not found",
        )
    return collection


async def require_document(
    document_id: UUID,
    repo: DocumentRepository,
) -> Document:
    """
    Get a document by ID or raise 404.

    DRY helper to avoid repeating this check in every endpoint.
    """
    document = await repo.get_by_id(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{document_id}' not found",
        )
    return document


async def check_collection_name_unique(
    name: str,
    repo: CollectionRepository,
    exclude_id: UUID | None = None,
) -> None:
    """
    Check if a collection name is unique, raise 409 if not.

    DRY helper for create/update collection operations.
    """
    if await repo.name_exists(name, exclude_id=exclude_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Collection with name '{name}' already exists",
        )
