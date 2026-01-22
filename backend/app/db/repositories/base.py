"""Base repository with common CRUD operations."""

from collections.abc import Sequence
from typing import Any, Generic, TypeVar, cast
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """
    Base repository providing common CRUD operations.

    Attributes:
        model: The SQLAlchemy model class
        session: The async database session
    """

    def __init__(self, model: type[ModelType], session: AsyncSession):
        self.model = model
        self.session = session

    async def get_by_id(self, id: UUID) -> ModelType | None:
        """Get a single record by ID."""
        return await self.session.get(self.model, id)

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[ModelType]:
        """Get all records with pagination."""
        stmt = select(self.model).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count(self) -> int:
        """Count total records."""
        stmt = select(func.count()).select_from(self.model)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def create(self, obj: ModelType) -> ModelType:
        """Create a new record."""
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def update(self, obj: ModelType) -> ModelType:
        """Update an existing record."""
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def delete(self, obj: ModelType) -> None:
        """Delete a record."""
        await self.session.delete(obj)
        await self.session.flush()

    async def delete_by_id(self, id: UUID) -> bool:
        """Delete a record by ID. Returns True if deleted."""
        stmt = delete(self.model).where(cast(Any, self.model).id == id)
        result = cast(CursorResult[Any], await self.session.execute(stmt))
        await self.session.flush()
        return (result.rowcount or 0) > 0

    async def exists(self, id: UUID) -> bool:
        """Check if a record exists."""
        stmt = select(func.count()).where(cast(Any, self.model).id == id)
        result = await self.session.execute(stmt)
        return (result.scalar() or 0) > 0
