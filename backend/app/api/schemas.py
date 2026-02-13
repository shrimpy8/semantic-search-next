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
    is_trusted: bool = Field(
        default=False,
        description="Whether this collection is from a trusted/verified source"
    )


class CollectionCreate(CollectionBase):
    """Schema for creating a collection."""

    pass


class CollectionUpdate(BaseModel):
    """Schema for updating a collection (all fields optional)."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    metadata: dict[str, Any] | None = None
    settings: CollectionSettingsSchema | None = None
    is_trusted: bool | None = Field(
        default=None,
        description="Whether this collection is from a trusted/verified source"
    )


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
            is_trusted=getattr(model, "is_trusted", False),
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
    top_k: int | None = Field(
        default=None,
        ge=1,
        le=50,
        description="Number of results to retrieve. Uses default from settings if not provided."
    )
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
    source_trusted: bool = Field(
        default=False,
        description="Whether the source collection is marked as trusted"
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

    # Search configuration (for evaluation capture)
    search_alpha: float | None = Field(
        default=None,
        description="Semantic weight used (0=BM25 only, 1=semantic only)"
    )
    search_use_reranker: bool | None = Field(
        default=None,
        description="Whether reranking was enabled"
    )
    reranker_provider: str | None = Field(
        default=None,
        description="Reranker used (jina, cohere)"
    )
    chunk_size: int | None = Field(
        default=None,
        description="Document chunk size in characters"
    )
    chunk_overlap: int | None = Field(
        default=None,
        description="Overlap between chunks in characters"
    )
    embedding_model: str | None = Field(
        default=None,
        description="Embedding model used for semantic search"
    )
    answer_model: str | None = Field(
        default=None,
        description="LLM model used for answer generation"
    )

    # Injection detection warnings (M3A - informational only)
    injection_warning: bool = Field(
        default=False,
        description="True if potential injection patterns detected (score > 0.7)"
    )
    injection_details: dict | None = Field(
        default=None,
        description="Details about detected patterns (query and/or chunks)"
    )

    # Input sanitization (M3B)
    sanitization_applied: bool = Field(
        default=False,
        description="True if injection patterns were stripped from the query"
    )

    # Trust boundaries (M4)
    untrusted_sources_in_answer: bool = Field(
        default=False,
        description="True if AI answer includes content from untrusted collections"
    )
    untrusted_source_names: list[str] = Field(
        default_factory=list,
        description="Names of untrusted collections used in AI answer"
    )


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

    # Evaluation settings
    eval_judge_provider: str = Field(
        description="LLM provider for evaluations (openai, anthropic, ollama, disabled)"
    )
    eval_judge_model: str = Field(
        description="LLM model for evaluations (varies by provider)"
    )

    # Answer generation settings
    answer_provider: str = Field(
        description="LLM provider for RAG answer generation (openai, anthropic, ollama)"
    )
    answer_model: str = Field(
        description="LLM model for answer generation (varies by provider)"
    )
    answer_style: str = Field(
        description="Answer style: concise (brief), balanced (default), or detailed (comprehensive)"
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
            eval_judge_provider=model.eval_judge_provider,
            eval_judge_model=model.eval_judge_model,
            answer_provider=model.answer_provider,
            answer_model=model.answer_model,
            answer_style=model.answer_style,
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

    # Evaluation settings
    eval_judge_provider: str | None = Field(
        default=None,
        pattern="^(openai|anthropic|ollama|disabled)$",
        description="LLM provider for evaluations (openai, anthropic, ollama, disabled)"
    )
    eval_judge_model: str | None = Field(
        default=None,
        max_length=100,
        description="LLM model for evaluations (varies by provider)"
    )

    # Answer generation settings
    answer_provider: str | None = Field(
        default=None,
        pattern="^(openai|anthropic|ollama)$",
        description="LLM provider for RAG answer generation (openai, anthropic, ollama)"
    )
    answer_model: str | None = Field(
        default=None,
        max_length=100,
        description="LLM model for answer generation (varies by provider)"
    )
    answer_style: str | None = Field(
        default=None,
        pattern="^(concise|balanced|detailed)$",
        description="Answer style: concise (brief), balanced (default), or detailed (comprehensive)"
    )

    # Safety confirmation
    confirm_reindex: bool | None = Field(
        default=None,
        description="Confirm reindex when changing embedding model"
    )


class SetupValidationItem(BaseModel):
    """Individual validation check result."""

    name: str = Field(description="Name of the check (e.g., 'OpenAI API Key')")
    status: str = Field(description="Status: 'ok', 'warning', 'error', 'not_configured'")
    message: str = Field(description="Human-readable status message")
    required: bool = Field(description="Whether this is required for basic operation")


class SetupValidationResponse(BaseModel):
    """Response for setup validation check."""

    ready: bool = Field(description="Whether system is ready for search operations")
    checks: list[SetupValidationItem] = Field(description="Individual validation checks")
    summary: str = Field(description="Summary message about overall setup status")


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


# ============================================================================
# Evaluation Schemas (Ground Truth + Evaluation Results)
# ============================================================================


class GroundTruthCreate(BaseModel):
    """Schema for creating a ground truth entry."""

    collection_id: UUID = Field(description="Collection this ground truth belongs to")
    query: str = Field(..., min_length=1, max_length=2000, description="The question/query")
    expected_answer: str = Field(..., min_length=1, description="The expected/gold standard answer")
    expected_sources: list[str] | None = Field(
        default=None,
        description="Optional: document names that should be retrieved"
    )
    notes: str | None = Field(default=None, description="Optional notes about this ground truth")


class GroundTruthUpdate(BaseModel):
    """Schema for updating a ground truth entry (all fields optional)."""

    query: str | None = Field(None, min_length=1, max_length=2000, description="The question/query")
    expected_answer: str | None = Field(None, min_length=1, description="The expected/gold standard answer")
    expected_sources: list[str] | None = Field(default=None, description="Document names that should be retrieved")
    notes: str | None = Field(default=None, description="Notes about this ground truth")


class GroundTruthResponse(BaseModel):
    """Schema for ground truth response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    collection_id: UUID
    query: str
    expected_answer: str
    expected_sources: list[str] | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, model: Any) -> "GroundTruthResponse":
        """Convert SQLAlchemy model to Pydantic schema."""
        return cls(
            id=model.id,
            collection_id=model.collection_id,
            query=model.query,
            expected_answer=model.expected_answer,
            expected_sources=model.expected_sources,
            notes=model.notes,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )


class GroundTruthListResponse(BaseModel):
    """Paginated ground truth list response."""

    data: list[GroundTruthResponse]
    has_more: bool = False
    total_count: int = 0
    next_cursor: str | None = None


class EvaluationScoresSchema(BaseModel):
    """Evaluation scores breakdown."""

    # Retrieval metrics (0.0-1.0)
    context_relevance: float | None = Field(default=None, description="Are retrieved chunks relevant to query?")
    context_precision: float | None = Field(default=None, description="Are top results more relevant than lower?")
    context_coverage: float | None = Field(default=None, description="Do chunks cover all query aspects?")

    # Answer metrics (0.0-1.0)
    faithfulness: float | None = Field(default=None, description="Is answer grounded in context (no hallucinations)?")
    answer_relevance: float | None = Field(default=None, description="Does answer address the question?")
    completeness: float | None = Field(default=None, description="Does answer cover all aspects?")

    # Ground truth comparison (0.0-1.0)
    ground_truth_similarity: float | None = Field(default=None, description="Similarity to expected answer")

    # Aggregate scores
    retrieval_score: float | None = Field(default=None, description="Weighted average of retrieval metrics")
    answer_score: float | None = Field(default=None, description="Weighted average of answer metrics")
    overall_score: float | None = Field(default=None, description="Overall evaluation score")


class SearchConfigSchema(BaseModel):
    """Search configuration captured at evaluation time."""

    search_alpha: float | None = Field(default=None, description="Semantic weight (0=BM25 only, 1=semantic only)")
    search_preset: str | None = Field(default=None, description="Search preset (balanced, high_precision, high_recall, custom)")
    search_use_reranker: bool | None = Field(default=None, description="Whether reranking was enabled")
    reranker_provider: str | None = Field(default=None, description="Reranker used (jina, cohere, or null)")
    chunk_size: int | None = Field(default=None, description="Document chunk size in characters")
    chunk_overlap: int | None = Field(default=None, description="Overlap between chunks in characters")
    embedding_model: str | None = Field(default=None, description="Embedding model used for semantic search")
    answer_model: str | None = Field(default=None, description="LLM model used for answer generation")


class EvaluationResultResponse(BaseModel):
    """Schema for evaluation result response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    search_query_id: UUID | None = None
    ground_truth_id: UUID | None = None
    evaluation_run_id: UUID | None = None

    # Input data
    query: str
    generated_answer: str | None = None
    expected_answer: str | None = None

    # Judge info
    judge_provider: str
    judge_model: str

    # Scores
    scores: EvaluationScoresSchema

    # Search configuration (captured at evaluation time)
    search_config: SearchConfigSchema | None = None

    # Metadata
    eval_latency_ms: int | None = None
    error_message: str | None = None
    created_at: datetime

    @classmethod
    def from_model(cls, model: Any) -> "EvaluationResultResponse":
        """Convert SQLAlchemy model to Pydantic schema."""
        # Build search config if any field is set
        search_config = None
        # Use getattr with defaults for optional fields that may not exist in older DB records
        embedding_model = getattr(model, 'embedding_model', None)
        answer_model = getattr(model, 'answer_model', None)
        if any([
            model.search_alpha is not None,
            model.search_preset is not None,
            model.search_use_reranker is not None,
            model.reranker_provider is not None,
            model.chunk_size is not None,
            model.chunk_overlap is not None,
            embedding_model is not None,
            answer_model is not None,
        ]):
            search_config = SearchConfigSchema(
                search_alpha=model.search_alpha,
                search_preset=model.search_preset,
                search_use_reranker=model.search_use_reranker,
                reranker_provider=model.reranker_provider,
                chunk_size=model.chunk_size,
                chunk_overlap=model.chunk_overlap,
                embedding_model=embedding_model,
                answer_model=answer_model,
            )

        return cls(
            id=model.id,
            search_query_id=model.search_query_id,
            ground_truth_id=model.ground_truth_id,
            evaluation_run_id=model.evaluation_run_id,
            query=model.query,
            generated_answer=model.generated_answer,
            expected_answer=model.expected_answer,
            judge_provider=model.judge_provider,
            judge_model=model.judge_model,
            scores=EvaluationScoresSchema(
                context_relevance=model.context_relevance,
                context_precision=model.context_precision,
                context_coverage=model.context_coverage,
                faithfulness=model.faithfulness,
                answer_relevance=model.answer_relevance,
                completeness=model.completeness,
                ground_truth_similarity=model.ground_truth_similarity,
                retrieval_score=model.retrieval_score,
                answer_score=model.answer_score,
                overall_score=model.overall_score,
            ),
            search_config=search_config,
            eval_latency_ms=model.eval_latency_ms,
            error_message=model.error_message,
            created_at=model.created_at,
        )


class EvaluationResultListResponse(BaseModel):
    """Paginated evaluation result list response."""

    data: list[EvaluationResultResponse]
    has_more: bool = False
    total_count: int = 0
    next_cursor: str | None = None


class EvaluationStatsResponse(BaseModel):
    """Aggregate evaluation statistics."""

    total_evaluations: int = Field(description="Total number of evaluations")
    avg_overall_score: float | None = Field(default=None, description="Average overall score")
    avg_retrieval_score: float | None = Field(default=None, description="Average retrieval score")
    avg_answer_score: float | None = Field(default=None, description="Average answer score")

    # Individual metric averages
    avg_context_relevance: float | None = None
    avg_context_precision: float | None = None
    avg_context_coverage: float | None = None
    avg_faithfulness: float | None = None
    avg_answer_relevance: float | None = None
    avg_completeness: float | None = None

    # Score distribution
    excellent_count: int = Field(default=0, description="Scores > 0.8")
    good_count: int = Field(default=0, description="Scores 0.6-0.8")
    moderate_count: int = Field(default=0, description="Scores 0.4-0.6")
    poor_count: int = Field(default=0, description="Scores < 0.4")

    period_days: int = Field(description="Number of days covered by stats")


class ChunkForEvaluation(BaseModel):
    """Schema for a chunk used in evaluation."""

    content: str = Field(..., description="The chunk text content")
    source: str | None = Field(default=None, description="Source document name")
    metadata: dict[str, Any] | None = Field(default=None, description="Additional metadata")


class EvaluateRequest(BaseModel):
    """Schema for evaluating a Q&A pair."""

    query: str = Field(..., min_length=1, max_length=2000, description="The search query")
    answer: str = Field(..., min_length=1, description="The generated answer to evaluate")
    chunks: list[ChunkForEvaluation] = Field(
        ...,
        min_length=1,
        description="Retrieved chunks used to generate the answer"
    )
    ground_truth_id: UUID | None = Field(
        default=None,
        description="Optional ground truth ID for comparison"
    )
    search_query_id: UUID | None = Field(
        default=None,
        description="Optional search query ID to link evaluation to"
    )
    provider: str | None = Field(
        default=None,
        description="Judge provider (openai, anthropic, ollama). Defaults to config."
    )
    model: str | None = Field(
        default=None,
        description="Judge model. Defaults to provider default."
    )

    # Search configuration (optional - captured for comparison)
    search_alpha: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Semantic weight used (0=BM25 only, 1=semantic only)"
    )
    search_preset: str | None = Field(
        default=None,
        description="Search preset used (balanced, high_precision, high_recall, custom)"
    )
    search_use_reranker: bool | None = Field(
        default=None,
        description="Whether reranking was enabled"
    )
    reranker_provider: str | None = Field(
        default=None,
        description="Reranker used (jina, cohere)"
    )
    chunk_size: int | None = Field(
        default=None,
        description="Document chunk size in characters"
    )
    chunk_overlap: int | None = Field(
        default=None,
        description="Overlap between chunks in characters"
    )
    embedding_model: str | None = Field(
        default=None,
        description="Embedding model used for semantic search"
    )
    answer_model: str | None = Field(
        default=None,
        description="LLM model used for answer generation"
    )


class AvailableProvidersResponse(BaseModel):
    """Response with available and registered judge providers."""

    available: list[str] = Field(description="Providers ready to use (API key configured)")
    registered: list[str] = Field(description="All registered providers")
