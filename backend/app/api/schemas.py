"""
Pydantic v2 API schemas for request/response models.

These schemas are used for API validation and serialization,
separate from SQLAlchemy ORM models.
"""

from datetime import datetime
from typing import Any, Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# Generic type for paginated responses
T = TypeVar("T")


# ============================================================================
# Base Schemas
# ============================================================================


class TimestampMixin(BaseModel):
    """Mixin for created/updated timestamps."""

    created_at: datetime
    updated_at: datetime | None = None


# ============================================================================
# Collection Schemas
# ============================================================================


class CollectionSettingsSchema(BaseModel):
    """Collection settings schema."""

    model_config = ConfigDict(extra="allow")

    default_retrieval_method: str = "hybrid"
    default_top_k: int = 5
    use_reranking: bool = True


class CollectionBase(BaseModel):
    """Base collection fields."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict, validation_alias="metadata_")
    settings: CollectionSettingsSchema = Field(default_factory=CollectionSettingsSchema)


class CollectionCreate(CollectionBase):
    """Schema for creating a collection."""

    pass


class CollectionUpdate(BaseModel):
    """Schema for updating a collection (all fields optional)."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    metadata: dict[str, Any] | None = None
    settings: CollectionSettingsSchema | None = None


class CollectionResponse(CollectionBase):
    """Schema for collection response."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    document_count: int = 0
    chunk_count: int = 0
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, model: Any) -> "CollectionResponse":
        """
        Convert SQLAlchemy model to Pydantic schema.

        Handles the metadata_ -> metadata mapping since SQLAlchemy's
        'metadata' is a reserved attribute.
        """
        return cls(
            id=model.id,
            name=model.name,
            description=model.description,
            metadata=model.metadata_,
            settings=model.settings,
            document_count=model.document_count,
            chunk_count=model.chunk_count,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )


class CollectionListResponse(BaseModel):
    """Paginated collection list response."""

    data: list[CollectionResponse]
    has_more: bool = False
    total_count: int = 0
    next_cursor: str | None = None


# ============================================================================
# Document Schemas
# ============================================================================


class DocumentBase(BaseModel):
    """Base document fields."""

    filename: str = Field(..., min_length=1, max_length=255)
    metadata: dict[str, Any] = Field(default_factory=dict, validation_alias="metadata_")


class DocumentResponse(DocumentBase):
    """Schema for document response."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    collection_id: UUID
    file_hash: str
    file_size: int
    page_count: int | None = None
    chunk_count: int = 0
    status: str = "processing"
    error_message: str | None = None
    uploaded_at: datetime

    @classmethod
    def from_model(cls, model: Any) -> "DocumentResponse":
        """
        Convert SQLAlchemy model to Pydantic schema.

        Handles the metadata_ -> metadata mapping since SQLAlchemy's
        'metadata' is a reserved attribute.
        """
        return cls(
            id=model.id,
            filename=model.filename,
            collection_id=model.collection_id,
            file_hash=model.file_hash,
            file_size=model.file_size,
            page_count=model.page_count,
            chunk_count=model.chunk_count,
            metadata=model.metadata_,
            status=model.status,
            error_message=model.error_message,
            uploaded_at=model.uploaded_at,
        )


class DocumentListResponse(BaseModel):
    """Document list response."""

    data: list[DocumentResponse]
    total: int = 0


class DocumentChunkSchema(BaseModel):
    """Schema for a single document chunk."""

    id: str = Field(description="Chunk ID from vector store")
    content: str = Field(description="The text content of the chunk")
    chunk_index: int = Field(description="Position of chunk in document (0-indexed)")
    page: int | None = Field(default=None, description="Page number (for PDFs)")
    start_index: int | None = Field(default=None, description="Character offset in original document")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional chunk metadata")


class DocumentContentResponse(BaseModel):
    """Response schema for document content with all chunks."""

    document_id: UUID
    filename: str
    collection_id: UUID
    total_chunks: int = Field(description="Total number of chunks in document")
    chunks: list[DocumentChunkSchema] = Field(description="List of chunks in order")


# ============================================================================
# Search Schemas
# ============================================================================


class SearchRequest(BaseModel):
    """Schema for search request."""

    query: str = Field(..., min_length=1, max_length=2000)
    collection_id: UUID | None = None
    document_ids: list[UUID] | None = None
    preset: str = Field(default="balanced", pattern="^(high_precision|balanced|high_recall)$")
    top_k: int = Field(default=5, ge=1, le=50)
    alpha: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Hybrid search alpha (0 = keywords only, 1 = semantic only). Uses default from settings if not provided."
    )
    use_reranker: bool | None = Field(
        default=None,
        description="Whether to use reranking. Uses default from settings if not provided."
    )
    generate_answer: bool = Field(
        default=False,
        description="Whether to generate an AI answer using RAG. Adds latency but provides synthesized response."
    )


class SearchScoresSchema(BaseModel):
    """Score breakdown for a search result."""

    semantic_score: float | None = None
    bm25_score: float | None = None
    rerank_score: float | None = None
    final_score: float
    relevance_percent: int = Field(
        default=0,
        ge=0,
        le=100,
        description="Normalized relevance score (0-100%)"
    )


class SearchResultSchema(BaseModel):
    """Single search result."""

    id: str
    document_id: UUID
    document_name: str
    collection_id: UUID
    collection_name: str
    content: str
    page: int | None = None
    section: str | None = Field(
        default=None,
        description="Section or heading where content was found"
    )
    verified: bool = Field(
        default=True,
        description="True if result is from indexed document (not hallucinated)"
    )
    scores: SearchScoresSchema
    metadata: dict[str, Any] = Field(default_factory=dict)
    # Context expansion fields
    context_before: str | None = Field(
        default=None,
        description="Content from previous chunk(s) for context"
    )
    context_after: str | None = Field(
        default=None,
        description="Content from following chunk(s) for context"
    )
    chunk_index: int | None = Field(
        default=None,
        description="Position of this chunk in the document"
    )
    total_chunks: int | None = Field(
        default=None,
        description="Total number of chunks in the document"
    )


class CitationSchema(BaseModel):
    """A citation linking an answer claim to a source document."""

    claim: str = Field(description="The factual claim from the answer")
    source_index: int = Field(description="Index of the source document (0-based, -1 if unverified)")
    source_name: str = Field(description="Name of the source document")
    quote: str = Field(default="", description="Supporting quote from the document")
    verified: bool = Field(default=True, description="Whether the claim is supported")


class AnswerVerificationSchema(BaseModel):
    """Verification result for AI-generated answer."""

    confidence: str = Field(
        description="Confidence level: 'high', 'medium', 'low', or 'unverified'"
    )
    citations: list[CitationSchema] = Field(
        default_factory=list,
        description="List of citations linking claims to sources"
    )
    warning: str | None = Field(
        default=None,
        description="Warning message if verification found issues"
    )
    verified_claims: int = Field(default=0, description="Number of verified claims")
    total_claims: int = Field(default=0, description="Total number of claims extracted")
    coverage_percent: int = Field(
        default=0,
        ge=0,
        le=100,
        description="Percentage of claims that are verified"
    )


class SearchResponse(BaseModel):
    """Schema for search response."""

    query: str
    results: list[SearchResultSchema]
    low_confidence_results: list[SearchResultSchema] = Field(
        default_factory=list,
        description="Results below min_score_threshold, hidden by default"
    )
    low_confidence_count: int = Field(
        default=0,
        description="Number of low confidence results hidden"
    )
    min_score_threshold: float = Field(
        default=0.30,
        description="Threshold used to separate high/low confidence results"
    )
    answer: str | None = None
    answer_verification: AnswerVerificationSchema | None = Field(
        default=None,
        description="Verification result for the AI answer (citations, confidence)"
    )
    sources: list[str] = Field(default_factory=list)
    latency_ms: int
    retrieval_method: str


# ============================================================================
# Health Schemas
# ============================================================================


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "healthy"
    timestamp: datetime
    version: str = "0.1.0"
    services: dict[str, str] = Field(default_factory=dict)


# ============================================================================
# Error Schemas
# ============================================================================


class ErrorDetail(BaseModel):
    """Error detail schema."""

    loc: list[str] = Field(default_factory=list)
    msg: str
    type: str


class ErrorResponse(BaseModel):
    """Standard error response (RFC 7807 inspired)."""

    error: str
    message: str
    status_code: int
    details: list[ErrorDetail] = Field(default_factory=list)


class DeletedResponse(BaseModel):
    """Response for delete operations."""

    id: UUID
    object: str
    deleted: bool = True


# ============================================================================
# Settings Schemas
# ============================================================================


class SettingsResponse(BaseModel):
    """Response schema for application settings."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID

    # Search defaults
    default_alpha: float = Field(
        ge=0.0,
        le=1.0,
        description="Hybrid search alpha (0 = keywords only, 1 = semantic only)"
    )
    default_use_reranker: bool = Field(description="Whether to use reranking by default")
    default_preset: str = Field(description="Default retrieval preset")
    default_top_k: int = Field(ge=1, le=50, description="Default number of results")

    # Admin/Advanced settings
    embedding_model: str = Field(description="OpenAI embedding model to use")
    chunk_size: int = Field(ge=100, le=4000, description="Document chunk size in characters")
    chunk_overlap: int = Field(ge=0, le=1000, description="Overlap between chunks")
    reranker_provider: str = Field(description="Reranker provider (auto/jina/cohere)")

    # Display settings
    show_scores: bool = Field(description="Show detailed scores in UI")
    results_per_page: int = Field(ge=5, le=50, description="Results per page in UI")

    # Quality threshold
    min_score_threshold: float = Field(
        ge=0.0,
        le=1.0,
        description="Minimum relevance score threshold (0-1). Results below this are hidden by default as 'low confidence'. Based on final_score which uses rerank score when reranking is enabled."
    )

    # AI Answer settings
    default_generate_answer: bool = Field(
        description="Whether to generate AI answers by default"
    )
    context_window_size: int = Field(
        ge=1,
        le=3,
        description="Number of chunks to fetch before/after matched chunk (1-3)"
    )

    # Timestamps
    updated_at: datetime

    @classmethod
    def from_model(cls, model: Any) -> "SettingsResponse":
        """Convert SQLAlchemy model to Pydantic schema."""
        return cls(
            id=model.id,
            default_alpha=model.default_alpha,
            default_use_reranker=model.default_use_reranker,
            default_preset=model.default_preset,
            default_top_k=model.default_top_k,
            embedding_model=model.embedding_model,
            chunk_size=model.chunk_size,
            chunk_overlap=model.chunk_overlap,
            reranker_provider=model.reranker_provider,
            show_scores=model.show_scores,
            results_per_page=model.results_per_page,
            min_score_threshold=model.min_score_threshold,
            default_generate_answer=model.default_generate_answer,
            context_window_size=model.context_window_size,
            updated_at=model.updated_at,
        )


class SettingsUpdate(BaseModel):
    """Schema for updating settings (all fields optional)."""

    # Search defaults
    default_alpha: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Hybrid search alpha (0 = keywords only, 1 = semantic only)"
    )
    default_use_reranker: bool | None = Field(
        default=None,
        description="Whether to use reranking by default"
    )
    default_preset: str | None = Field(
        default=None,
        pattern="^(high_precision|balanced|high_recall)$",
        description="Default retrieval preset"
    )
    default_top_k: int | None = Field(
        default=None,
        ge=1,
        le=50,
        description="Default number of results"
    )

    # Admin/Advanced settings
    embedding_model: str | None = Field(
        default=None,
        description="OpenAI embedding model to use"
    )
    chunk_size: int | None = Field(
        default=None,
        ge=100,
        le=4000,
        description="Document chunk size in characters"
    )
    chunk_overlap: int | None = Field(
        default=None,
        ge=0,
        le=1000,
        description="Overlap between chunks"
    )
    reranker_provider: str | None = Field(
        default=None,
        pattern="^(auto|jina|cohere)$",
        description="Reranker provider"
    )

    # Display settings
    show_scores: bool | None = Field(
        default=None,
        description="Show detailed scores in UI"
    )
    results_per_page: int | None = Field(
        default=None,
        ge=5,
        le=50,
        description="Results per page in UI"
    )

    # Quality threshold
    min_score_threshold: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Minimum relevance score threshold (0-1). Results below this are hidden by default as 'low confidence'."
    )

    # AI Answer settings
    default_generate_answer: bool | None = Field(
        default=None,
        description="Whether to generate AI answers by default"
    )
    context_window_size: int | None = Field(
        default=None,
        ge=1,
        le=3,
        description="Number of chunks to fetch before/after matched chunk (1-3)"
    )


# ============================================================================
# Analytics Schemas
# ============================================================================


class SearchQuerySchema(BaseModel):
    """Schema for individual search query in history."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    query_text: str
    collection_id: UUID | None = None
    retrieval_method: str | None = None
    results_count: int | None = None
    latency_ms: int | None = None
    user_feedback: bool | None = None
    created_at: datetime


class SearchHistoryResponse(BaseModel):
    """Paginated search history response."""

    data: list[SearchQuerySchema]
    total: int
    limit: int
    offset: int
    has_more: bool = False


class SearchStatsResponse(BaseModel):
    """Aggregated search statistics response."""

    total_searches: int = Field(description="Total number of searches in period")
    avg_latency_ms: float = Field(description="Average search latency in milliseconds")
    success_rate: float = Field(
        ge=0, le=100, description="Percentage of searches with results"
    )
    successful_searches: int = Field(description="Number of searches with results > 0")
    zero_results_count: int = Field(description="Number of searches with no results")
    searches_by_preset: dict[str, int] = Field(
        default_factory=dict, description="Breakdown by retrieval method"
    )
    period_days: int = Field(description="Number of days covered by stats")


class TrendDataPoint(BaseModel):
    """Single data point in time series."""

    period: str = Field(description="ISO timestamp of the period start")
    search_count: int = Field(description="Number of searches in period")
    avg_latency_ms: float = Field(description="Average latency in period")


class SearchTrendsResponse(BaseModel):
    """Time-series search trends response."""

    data: list[TrendDataPoint]
    granularity: str = Field(description="Time granularity: 'hour', 'day', or 'week'")
    period_days: int = Field(description="Number of days covered")


class TopQuerySchema(BaseModel):
    """Top query with usage stats."""

    query: str = Field(description="The search query text (truncated)")
    count: int = Field(description="Number of times this query was searched")
    avg_latency_ms: float = Field(description="Average latency for this query")
    avg_results: float = Field(description="Average number of results")


class TopQueriesResponse(BaseModel):
    """Response with most frequent queries."""

    data: list[TopQuerySchema]
    period_days: int = Field(description="Number of days covered")


# ============================================================================
# Generic Response Wrapper
# ============================================================================


class OperationResult(BaseModel, Generic[T]):
    """Generic operation result with optional warnings."""

    success: bool = True
    data: T | None = None
    message: str | None = None
    warnings: list[str] = Field(default_factory=list)

    @property
    def has_warnings(self) -> bool:
        return len(self.warnings) > 0
