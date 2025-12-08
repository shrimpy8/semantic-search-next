"""
SQLAlchemy ORM models.

Database models for collections, documents, and search history.
Uses PostgreSQL with UUID primary keys and JSONB for flexible metadata.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Collection(Base):
    """
    Collection model for organizing documents.

    Attributes:
        id: UUID primary key
        name: Unique collection name
        description: Optional description
        metadata_: Flexible JSONB metadata
        settings: Collection settings (retrieval config, etc.)
        document_count: Computed document count
        chunk_count: Computed total chunks across documents
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "collections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
        server_default="{}",
    )
    settings: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default="{}",
    )
    document_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    chunk_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    documents: Mapped[list["Document"]] = relationship(
        "Document",
        back_populates="collection",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Collection(id={self.id}, name='{self.name}')>"


class Document(Base):
    """
    Document model for uploaded files.

    Attributes:
        id: UUID primary key
        collection_id: Foreign key to parent collection
        filename: Original filename
        file_hash: SHA256 hash for deduplication
        file_size: File size in bytes
        page_count: Number of pages (for PDFs)
        chunk_count: Number of chunks after processing
        metadata_: Flexible JSONB metadata
        status: Processing status (processing, ready, error)
        error_message: Error details if status is 'error'
        uploaded_at: Upload timestamp
    """

    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    collection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("collections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    chunk_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
        server_default="{}",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="processing",
        server_default="'processing'",
        index=True,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    collection: Mapped["Collection"] = relationship(
        "Collection",
        back_populates="documents",
    )

    # Constraints
    __table_args__ = (
        Index(
            "idx_documents_collection_hash",
            "collection_id",
            "file_hash",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return f"<Document(id={self.id}, filename='{self.filename}')>"


class SearchQuery(Base):
    """
    Search query history for analytics.

    Attributes:
        id: UUID primary key
        query_text: The search query
        collection_id: Optional collection scope
        retrieval_method: Method used (semantic, bm25, hybrid)
        results_count: Number of results returned
        latency_ms: Search latency in milliseconds
        user_feedback: Optional user feedback (thumbs up/down)
        created_at: Query timestamp
    """

    __tablename__ = "search_queries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    query_text: Mapped[str] = mapped_column(Text, nullable=False)
    collection_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("collections.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    retrieval_method: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    results_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    user_feedback: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    def __repr__(self) -> str:
        return f"<SearchQuery(id={self.id}, query='{self.query_text[:50]}...')>"


class Settings(Base):
    """
    Application settings using singleton pattern.

    Uses key='global' for the single row containing all application settings.

    Attributes:
        id: UUID primary key
        key: Unique key (always 'global' for singleton)
        default_alpha: Hybrid search alpha (0-1, semantic vs BM25)
        default_use_reranker: Whether to use reranking by default
        default_preset: Default retrieval preset
        default_top_k: Default number of results to return
        embedding_model: OpenAI embedding model name
        chunk_size: Document chunk size in characters
        chunk_overlap: Overlap between chunks
        reranker_provider: Reranker provider (auto/jina/cohere)
        show_scores: Show detailed scores in UI
        results_per_page: Results per page in UI
        updated_at: Last update timestamp
    """

    __tablename__ = "settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    key: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
        default="global",
        server_default="'global'",
    )

    # Search defaults
    default_alpha: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.5,
        server_default="0.5",
    )
    default_use_reranker: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    default_preset: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="balanced",
        server_default="'balanced'",
    )
    default_top_k: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=5,
        server_default="5",
    )

    # Admin/Advanced settings
    embedding_model: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="text-embedding-3-large",
        server_default="'text-embedding-3-large'",
    )
    chunk_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1000,
        server_default="1000",
    )
    chunk_overlap: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=200,
        server_default="200",
    )
    reranker_provider: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="auto",
        server_default="'auto'",
    )

    # Display settings
    show_scores: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    results_per_page: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=10,
        server_default="10",
    )

    # Quality threshold - results below this score are hidden by default
    # The final_score (rerank score when enabled) determines relevance.
    # Results below this threshold are considered "low confidence" and hidden unless user explicitly shows them.
    min_score_threshold: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.30,
        server_default="0.30",
    )

    # AI Answer settings
    # Whether to generate AI answers by default (can be overridden per-request)
    default_generate_answer: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    # Context window size - number of chunks to fetch before/after matched chunk
    # 1 = minimal context (fast), 2 = balanced, 3 = maximum context
    context_window_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        server_default="1",
    )

    # Timestamps
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __repr__(self) -> str:
        return f"<Settings(id={self.id}, key='{self.key}')>"
