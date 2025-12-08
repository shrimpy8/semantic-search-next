"""Settings repository for database operations."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Settings
from app.db.repositories.base import BaseRepository


class SettingsRepository(BaseRepository[Settings]):
    """
    Repository for Settings operations.

    Uses singleton pattern - there's only one 'global' settings row.
    """

    def __init__(self, session: AsyncSession):
        super().__init__(Settings, session)

    async def get(self) -> Settings:
        """
        Get the global settings.

        Creates default settings if none exist (shouldn't happen
        since migration creates the initial row).
        """
        stmt = select(Settings).where(Settings.key == "global")
        result = await self.session.execute(stmt)
        settings = result.scalar_one_or_none()

        if not settings:
            # Create default settings if somehow missing
            settings = Settings(key="global")
            self.session.add(settings)
            await self.session.flush()
            await self.session.refresh(settings)

        return settings

    async def update_settings(self, **kwargs: Any) -> Settings:
        """
        Update settings with provided values.

        Only updates fields that are explicitly provided.

        Args:
            **kwargs: Field names and values to update

        Returns:
            Updated Settings instance
        """
        settings = await self.get()

        # Only update allowed fields
        allowed_fields = {
            "default_alpha",
            "default_use_reranker",
            "default_preset",
            "default_top_k",
            "embedding_model",
            "chunk_size",
            "chunk_overlap",
            "reranker_provider",
            "show_scores",
            "results_per_page",
            "min_score_threshold",
            "default_generate_answer",
            "context_window_size",
        }

        for field, value in kwargs.items():
            if field in allowed_fields and value is not None:
                setattr(settings, field, value)

        await self.session.flush()
        await self.session.refresh(settings)
        return settings

    async def reset_to_defaults(self) -> Settings:
        """
        Reset all settings to their default values.

        Returns:
            Settings instance with default values
        """
        settings = await self.get()

        # Reset to defaults
        settings.default_alpha = 0.5
        settings.default_use_reranker = True
        settings.default_preset = "balanced"
        settings.default_top_k = 5
        settings.embedding_model = "text-embedding-3-large"
        settings.chunk_size = 1000
        settings.chunk_overlap = 200
        settings.reranker_provider = "auto"
        settings.show_scores = True
        settings.results_per_page = 10
        settings.min_score_threshold = 0.3
        settings.default_generate_answer = False
        settings.context_window_size = 1

        await self.session.flush()
        await self.session.refresh(settings)
        return settings
