"""Database package."""

from app.db.models import Collection, Document, SearchQuery, Settings
from app.db.repositories import (
    BaseRepository,
    CollectionRepository,
    DocumentRepository,
    SettingsRepository,
)
from app.db.session import Base, async_session_factory, close_db, get_db, init_db

__all__ = [
    # Session
    "Base",
    "get_db",
    "init_db",
    "close_db",
    "async_session_factory",
    # Models
    "Collection",
    "Document",
    "SearchQuery",
    "Settings",
    # Repositories
    "BaseRepository",
    "CollectionRepository",
    "DocumentRepository",
    "SettingsRepository",
]
