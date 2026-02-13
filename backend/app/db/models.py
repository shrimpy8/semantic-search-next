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
    is_trusted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
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

    # New columns for evaluation data capture
    retrieved_chunks: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSONB,
        nullable=True,
    )
    generated_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    answer_sources: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
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
        default=0.35,
        server_default="0.35",
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

    # Evaluation settings
    # LLM provider to use for evaluations (openai, anthropic, ollama, or disabled)
    eval_judge_provider: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="openai",
        server_default="'openai'",
    )
    # LLM model to use for evaluations (varies by provider)
    eval_judge_model: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="gpt-4o-mini",
        server_default="'gpt-4o-mini'",
    )

    # Answer generation settings
    # LLM provider for RAG answer generation (openai, anthropic, ollama)
    answer_provider: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="openai",
        server_default="'openai'",
    )
    # LLM model for answer generation (varies by provider)
    answer_model: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="gpt-4o-mini",
        server_default="'gpt-4o-mini'",
    )
    # Answer style: concise, balanced, or detailed
    # Controls prompt used for RAG answer generation
    answer_style: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="balanced",
        server_default="'balanced'",
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


# =============================================================================
# Evaluation Models
# =============================================================================


class GroundTruth(Base):
    """
    Ground truth entries for evaluation comparison.

    Stores expected (gold standard) answers for specific queries,
    allowing comparison between generated and expected answers.

    Attributes:
        id: UUID primary key
        collection_id: Scope to specific collection
        query: The question/query text
        expected_answer: The gold standard answer
        expected_sources: Optional list of expected source documents
        notes: Optional notes about why this is the expected answer
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "ground_truths"

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
    query: Mapped[str] = mapped_column(Text, nullable=False)
    expected_answer: Mapped[str] = mapped_column(Text, nullable=False)
    expected_sources: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    collection: Mapped["Collection"] = relationship("Collection")

    def __repr__(self) -> str:
        return f"<GroundTruth(id={self.id}, query='{self.query[:50]}...')>"


class EvaluationRun(Base):
    """
    Batch evaluation job tracking (Phase 2).

    Tracks the status and progress of batch evaluation jobs
    that evaluate multiple searches at once.

    Attributes:
        id: UUID primary key
        name: Optional descriptive name
        description: Optional description
        status: Job status (pending/running/completed/failed)
        judge_provider: LLM provider used (openai/anthropic/ollama)
        judge_model: Specific model used
        collection_id: Optional scope to collection
        total_count: Total searches to evaluate
        completed_count: Successfully evaluated count
        failed_count: Failed evaluation count
        created_at: Job creation timestamp
        started_at: Job start timestamp
        completed_at: Job completion timestamp
        error_message: Error details if failed
    """

    __tablename__ = "evaluation_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        server_default="'pending'",
        index=True,
    )
    judge_provider: Mapped[str] = mapped_column(String(20), nullable=False)
    judge_model: Mapped[str] = mapped_column(String(100), nullable=False)
    collection_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("collections.id", ondelete="SET NULL"),
        nullable=True,
    )
    total_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    completed_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    failed_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    collection: Mapped["Collection | None"] = relationship("Collection")
    results: Mapped[list["EvaluationResult"]] = relationship(
        "EvaluationResult",
        back_populates="evaluation_run",
        lazy="selectin",
    )

    @property
    def progress_percent(self) -> float:
        """Calculate completion percentage."""
        if self.total_count == 0:
            return 0.0
        return (self.completed_count + self.failed_count) / self.total_count * 100

    def __repr__(self) -> str:
        return f"<EvaluationRun(id={self.id}, status='{self.status}')>"


class EvaluationResult(Base):
    """
    Individual evaluation result with all metric scores.

    Stores the complete evaluation of a single Q&A pair,
    including retrieval metrics, answer metrics, and ground truth comparison.

    Attributes:
        id: UUID primary key
        search_query_id: Link to original search (optional)
        ground_truth_id: Link to ground truth if used (optional)
        evaluation_run_id: Link to batch run if part of batch (optional)
        query: The evaluated query
        generated_answer: The LLM-generated answer
        expected_answer: Expected answer from ground truth
        retrieved_chunks: The chunks used for evaluation
        judge_provider: LLM provider used for judging
        judge_model: Specific model used for judging
        context_relevance: Retrieval metric (0-1)
        context_precision: Retrieval metric (0-1)
        context_coverage: Retrieval metric (0-1)
        faithfulness: Answer metric (0-1)
        answer_relevance: Answer metric (0-1)
        completeness: Answer metric (0-1)
        ground_truth_similarity: Comparison to expected (0-1)
        retrieval_score: Aggregate retrieval score
        answer_score: Aggregate answer score
        overall_score: Combined overall score
        raw_eval_response: Raw LLM response for debugging
        eval_latency_ms: Evaluation time in milliseconds
        error_message: Error details if evaluation failed
        created_at: Evaluation timestamp
    """

    __tablename__ = "evaluation_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Foreign keys
    search_query_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("search_queries.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    ground_truth_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ground_truths.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    evaluation_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("evaluation_runs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Input data (stored for reproducibility)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    generated_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    retrieved_chunks: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    # Judge info
    judge_provider: Mapped[str] = mapped_column(String(20), nullable=False)
    judge_model: Mapped[str] = mapped_column(String(100), nullable=False)

    # Retrieval Metrics (0.0-1.0)
    context_relevance: Mapped[float | None] = mapped_column(Float, nullable=True)
    context_precision: Mapped[float | None] = mapped_column(Float, nullable=True)
    context_coverage: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Answer Metrics (0.0-1.0)
    faithfulness: Mapped[float | None] = mapped_column(Float, nullable=True)
    answer_relevance: Mapped[float | None] = mapped_column(Float, nullable=True)
    completeness: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Ground Truth Comparison (0.0-1.0)
    ground_truth_similarity: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Aggregate scores
    retrieval_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    answer_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    overall_score: Mapped[float | None] = mapped_column(Float, nullable=True, index=True)

    # Raw LLM output for debugging
    raw_eval_response: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    # Search configuration (captured at evaluation time)
    search_alpha: Mapped[float | None] = mapped_column(Float, nullable=True)
    search_preset: Mapped[str | None] = mapped_column(String(20), nullable=True)
    search_use_reranker: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    reranker_provider: Mapped[str | None] = mapped_column(String(20), nullable=True)
    chunk_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    chunk_overlap: Mapped[int | None] = mapped_column(Integer, nullable=True)
    embedding_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    answer_model: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Metadata
    eval_latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    # Relationships
    search_query: Mapped["SearchQuery | None"] = relationship("SearchQuery")
    ground_truth: Mapped["GroundTruth | None"] = relationship("GroundTruth")
    evaluation_run: Mapped["EvaluationRun | None"] = relationship(
        "EvaluationRun",
        back_populates="results",
    )

    def __repr__(self) -> str:
        score = f"{self.overall_score:.2f}" if self.overall_score else "N/A"
        return f"<EvaluationResult(id={self.id}, score={score})>"
