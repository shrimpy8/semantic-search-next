"""Collection repository for database operations."""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Collection, Document
from app.db.repositories.base import BaseRepository


class CollectionRepository(BaseRepository[Collection]):
    """Repository for Collection CRUD operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(Collection, session)

    async def get_by_name(self, name: str) -> Collection | None:
        """Get a collection by name."""
        stmt = select(Collection).where(Collection.name == name)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_with_documents(self, id: UUID) -> Collection | None:
        """Get a collection with its documents loaded."""
        stmt = (
            select(Collection)
            .options(selectinload(Collection.documents))
            .where(Collection.id == id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_with_pagination(
        self,
        limit: int = 10,
        starting_after: UUID | None = None,
    ) -> tuple[Sequence[Collection], bool]:
        """
        List collections with cursor-based pagination.

        Returns:
            Tuple of (collections, has_more)
        """
        stmt = select(Collection).order_by(Collection.created_at.desc())

        if starting_after:
            # Get the created_at of the cursor
            cursor_stmt = select(Collection.created_at).where(
                Collection.id == starting_after
            )
            cursor_result = await self.session.execute(cursor_stmt)
            cursor_created_at = cursor_result.scalar_one_or_none()

            if cursor_created_at:
                stmt = stmt.where(Collection.created_at < cursor_created_at)

        # Fetch one extra to check if there's more
        stmt = stmt.limit(limit + 1)
        result = await self.session.execute(stmt)
        collections = list(result.scalars().all())

        has_more = len(collections) > limit
        if has_more:
            collections = collections[:limit]

        return collections, has_more

    async def update_counts(self, collection_id: UUID) -> None:
        """Update document_count and chunk_count for a collection."""
        # Count documents
        doc_count_stmt = select(func.count()).where(
            Document.collection_id == collection_id
        )
        doc_result = await self.session.execute(doc_count_stmt)
        doc_count = doc_result.scalar() or 0

        # Sum chunk counts
        chunk_sum_stmt = select(func.coalesce(func.sum(Document.chunk_count), 0)).where(
            Document.collection_id == collection_id
        )
        chunk_result = await self.session.execute(chunk_sum_stmt)
        chunk_count = chunk_result.scalar() or 0

        # Update collection
        collection = await self.get_by_id(collection_id)
        if collection:
            collection.document_count = doc_count
            collection.chunk_count = chunk_count
            await self.session.flush()

    async def name_exists(self, name: str, exclude_id: UUID | None = None) -> bool:
        """Check if a collection name already exists."""
        stmt = select(func.count()).where(Collection.name == name)
        if exclude_id:
            stmt = stmt.where(Collection.id != exclude_id)
        result = await self.session.execute(stmt)
        return (result.scalar() or 0) > 0
