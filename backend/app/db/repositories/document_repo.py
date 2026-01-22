"""Document repository for database operations."""

from collections.abc import Sequence
from typing import Any, cast
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Document
from app.db.repositories.base import BaseRepository


class DocumentRepository(BaseRepository[Document]):
    """Repository for Document CRUD operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(Document, session)

    async def get_by_collection(
        self,
        collection_id: UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Document]:
        """Get all documents in a collection."""
        stmt = (
            select(Document)
            .where(Document.collection_id == collection_id)
            .order_by(Document.uploaded_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_by_collection(self, collection_id: UUID) -> int:
        """Count documents in a collection."""
        stmt = select(func.count()).where(Document.collection_id == collection_id)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def get_by_hash(
        self,
        collection_id: UUID,
        file_hash: str,
    ) -> Document | None:
        """Get a document by its hash within a collection."""
        stmt = select(Document).where(
            Document.collection_id == collection_id,
            Document.file_hash == file_hash,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def hash_exists(
        self,
        collection_id: UUID,
        file_hash: str,
        exclude_id: UUID | None = None,
    ) -> bool:
        """Check if a document hash exists in a collection."""
        stmt = select(func.count()).where(
            Document.collection_id == collection_id,
            Document.file_hash == file_hash,
        )
        if exclude_id:
            stmt = stmt.where(Document.id != exclude_id)
        result = await self.session.execute(stmt)
        return (result.scalar() or 0) > 0

    async def delete_by_collection(self, collection_id: UUID) -> int:
        """Delete all documents in a collection. Returns count deleted."""
        stmt = delete(Document).where(Document.collection_id == collection_id)
        result = cast(CursorResult[Any], await self.session.execute(stmt))
        await self.session.flush()
        return result.rowcount or 0

    async def update_status(
        self,
        document_id: UUID,
        status: str,
        error_message: str | None = None,
        page_count: int | None = None,
        chunk_count: int | None = None,
    ) -> Document | None:
        """
        Update document processing status and optional counts.

        Args:
            document_id: Document ID
            status: New status (processing, ready, error)
            error_message: Error message if status is 'error'
            page_count: Number of pages (for PDFs)
            chunk_count: Number of chunks after processing
        """
        doc = await self.get_by_id(document_id)
        if doc:
            doc.status = status
            if error_message is not None:
                doc.error_message = error_message
            if page_count is not None:
                doc.page_count = page_count
            if chunk_count is not None:
                doc.chunk_count = chunk_count
            await self.session.flush()
        return doc

    async def update_chunk_count(
        self,
        document_id: UUID,
        chunk_count: int,
    ) -> Document | None:
        """Update document chunk count after processing."""
        doc = await self.get_by_id(document_id)
        if doc:
            doc.chunk_count = chunk_count
            await self.session.flush()
        return doc

    async def list_by_status(
        self,
        status: str,
        limit: int = 100,
    ) -> Sequence[Document]:
        """List documents by status (useful for processing queue)."""
        stmt = (
            select(Document)
            .where(Document.status == status)
            .order_by(Document.uploaded_at.asc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()
