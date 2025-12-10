"""Database package."""

from app.db.models import (
    Collection,
    Document,
    EvaluationResult,
    EvaluationRun,
    GroundTruth,
    SearchQuery,
    Settings,
)
from app.db.repositories import (
    BaseRepository,
    CollectionRepository,
    DocumentRepository,
    EvaluationResultRepository,
    EvaluationRunRepository,
    GroundTruthRepository,
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
    "EvaluationResult",
    "EvaluationRun",
    "GroundTruth",
    "SearchQuery",
    "Settings",
    # Repositories
    "BaseRepository",
    "CollectionRepository",
    "DocumentRepository",
    "EvaluationResultRepository",
    "EvaluationRunRepository",
    "GroundTruthRepository",
    "SettingsRepository",
]
