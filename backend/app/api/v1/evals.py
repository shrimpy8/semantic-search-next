"""
Evaluation API endpoints.

Provides ground truth management and evaluation result retrieval.
"""

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import (
    CollectionRepo,
    DbSession,
    EvaluationResultRepo,
    GroundTruthRepo,
    SettingsRepo,
    require_collection,
    require_ground_truth,
)
from app.api.schemas import (
    AvailableProvidersResponse,
    DeletedResponse,
    EvaluateRequest,
    EvaluationResultListResponse,
    EvaluationResultResponse,
    EvaluationStatsResponse,
    GroundTruthCreate,
    GroundTruthListResponse,
    GroundTruthResponse,
    GroundTruthUpdate,
)
from app.core.exceptions import EvaluationError, JudgeUnavailableError
from app.db.models import GroundTruth
from app.services.evaluation import EvaluationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/evals", tags=["evaluations"])


# ============================================================================
# Ground Truth Endpoints
# ============================================================================


@router.get(
    "/ground-truths",
    response_model=GroundTruthListResponse,
    summary="List ground truths",
    description="List all ground truths with optional filtering by collection.",
)
async def list_ground_truths(
    db: DbSession,
    ground_truth_repo: GroundTruthRepo,
    collection_id: UUID | None = Query(default=None, description="Filter by collection ID"),
    limit: int = Query(default=20, ge=1, le=100, description="Maximum number of results"),
    starting_after: UUID | None = Query(default=None, description="Cursor for pagination"),
) -> GroundTruthListResponse:
    """List ground truths with cursor-based pagination."""
    ground_truths, has_more = await ground_truth_repo.list_with_pagination(
        collection_id=collection_id,
        limit=limit,
        starting_after=starting_after,
    )

    # Get total count for the filter
    if collection_id:
        total_count = await ground_truth_repo.count_by_collection(collection_id)
    else:
        total_count = await ground_truth_repo.count()

    # Determine next cursor
    next_cursor = None
    if has_more and ground_truths:
        next_cursor = str(ground_truths[-1].id)

    return GroundTruthListResponse(
        data=[GroundTruthResponse.from_model(gt) for gt in ground_truths],
        has_more=has_more,
        total_count=total_count,
        next_cursor=next_cursor,
    )


@router.post(
    "/ground-truths",
    response_model=GroundTruthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create ground truth",
    description="Create a new ground truth entry for evaluation.",
)
async def create_ground_truth(
    request: GroundTruthCreate,
    db: DbSession,
    ground_truth_repo: GroundTruthRepo,
    collection_repo: CollectionRepo,
) -> GroundTruthResponse:
    """Create a new ground truth entry."""
    # Validate collection exists
    await require_collection(request.collection_id, collection_repo)

    # Check for duplicate query in same collection
    existing = await ground_truth_repo.get_by_collection_and_query(
        collection_id=request.collection_id,
        query=request.query,
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ground truth with this query already exists in collection",
        )

    # Create ground truth
    ground_truth = GroundTruth(
        collection_id=request.collection_id,
        query=request.query,
        expected_answer=request.expected_answer,
        expected_sources=request.expected_sources,
        notes=request.notes,
    )
    created = await ground_truth_repo.create(ground_truth)
    await db.commit()
    await db.refresh(created)

    logger.info(f"Created ground truth {created.id} for collection {request.collection_id}")

    return GroundTruthResponse.from_model(created)


@router.get(
    "/ground-truths/{ground_truth_id}",
    response_model=GroundTruthResponse,
    summary="Get ground truth",
    description="Get a single ground truth by ID.",
)
async def get_ground_truth(
    ground_truth_id: UUID,
    ground_truth_repo: GroundTruthRepo,
) -> GroundTruthResponse:
    """Get a ground truth by ID."""
    ground_truth = await require_ground_truth(ground_truth_id, ground_truth_repo)
    return GroundTruthResponse.from_model(ground_truth)


@router.put(
    "/ground-truths/{ground_truth_id}",
    response_model=GroundTruthResponse,
    summary="Update ground truth",
    description="Update an existing ground truth entry.",
)
async def update_ground_truth(
    ground_truth_id: UUID,
    request: GroundTruthUpdate,
    db: DbSession,
    ground_truth_repo: GroundTruthRepo,
) -> GroundTruthResponse:
    """Update an existing ground truth."""
    ground_truth = await require_ground_truth(ground_truth_id, ground_truth_repo)

    # Build update data (only include provided fields)
    update_data = request.model_dump(exclude_unset=True)

    # If query is being changed, check for duplicates
    if "query" in update_data and update_data["query"] != ground_truth.query:
        existing = await ground_truth_repo.get_by_collection_and_query(
            collection_id=ground_truth.collection_id,
            query=update_data["query"],
        )
        if existing and existing.id != ground_truth_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ground truth with this query already exists in collection",
            )

    # Apply updates
    updated = await ground_truth_repo.update(ground_truth, update_data)
    await db.commit()
    await db.refresh(updated)

    logger.info(f"Updated ground truth {ground_truth_id}")

    return GroundTruthResponse.from_model(updated)


@router.delete(
    "/ground-truths/{ground_truth_id}",
    response_model=DeletedResponse,
    summary="Delete ground truth",
    description="Delete a ground truth entry.",
)
async def delete_ground_truth(
    ground_truth_id: UUID,
    db: DbSession,
    ground_truth_repo: GroundTruthRepo,
) -> DeletedResponse:
    """Delete a ground truth by ID."""
    ground_truth = await require_ground_truth(ground_truth_id, ground_truth_repo)

    await ground_truth_repo.delete(ground_truth)
    await db.commit()

    logger.info(f"Deleted ground truth {ground_truth_id}")

    return DeletedResponse(id=ground_truth_id, object="ground_truth")


# ============================================================================
# Evaluation Results Endpoints
# ============================================================================


@router.get(
    "/results",
    response_model=EvaluationResultListResponse,
    summary="List evaluation results",
    description="List evaluation results with optional filtering.",
)
async def list_evaluation_results(
    db: DbSession,
    eval_repo: EvaluationResultRepo,
    ground_truth_id: UUID | None = Query(default=None, description="Filter by ground truth ID"),
    search_query_id: UUID | None = Query(default=None, description="Filter by search query ID"),
    limit: int = Query(default=20, ge=1, le=100, description="Maximum number of results"),
    starting_after: UUID | None = Query(default=None, description="Cursor for pagination"),
) -> EvaluationResultListResponse:
    """List evaluation results with cursor-based pagination."""
    # Use appropriate filtering method
    if ground_truth_id:
        results = await eval_repo.get_by_ground_truth(ground_truth_id)
        total_count = len(results)
        has_more = False
    elif search_query_id:
        results = await eval_repo.get_by_search_query(search_query_id)
        total_count = len(results)
        has_more = False
    else:
        results, has_more = await eval_repo.list_with_pagination(
            limit=limit,
            starting_after=starting_after,
        )
        total_count = await eval_repo.count()

    # Determine next cursor
    next_cursor = None
    if has_more and results:
        next_cursor = str(results[-1].id)

    return EvaluationResultListResponse(
        data=[EvaluationResultResponse.from_model(r) for r in results],
        has_more=has_more,
        total_count=total_count,
        next_cursor=next_cursor,
    )


@router.get(
    "/results/{result_id}",
    response_model=EvaluationResultResponse,
    summary="Get evaluation result",
    description="Get a single evaluation result by ID.",
)
async def get_evaluation_result(
    result_id: UUID,
    eval_repo: EvaluationResultRepo,
) -> EvaluationResultResponse:
    """Get an evaluation result by ID with related entities."""
    result = await eval_repo.get_with_relations(result_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evaluation result '{result_id}' not found",
        )
    return EvaluationResultResponse.from_model(result)


# ============================================================================
# Evaluation Statistics Endpoints
# ============================================================================


@router.get(
    "/stats",
    response_model=EvaluationStatsResponse,
    summary="Get evaluation statistics",
    description="Get aggregate statistics for evaluations.",
)
async def get_evaluation_stats(
    eval_repo: EvaluationResultRepo,
    days: int = Query(default=30, ge=1, le=365, description="Number of days to include"),
) -> EvaluationStatsResponse:
    """Get aggregate evaluation statistics."""
    # Calculate date range
    end_date = datetime.now(UTC)
    start_date = end_date - timedelta(days=days)

    # Get aggregate stats from repository
    stats = await eval_repo.get_aggregate_stats(start_date=start_date)

    # Get score distribution
    distribution = await eval_repo.get_score_distribution(start_date=start_date)

    # Extract from nested structure
    overall = stats.get("overall_score", {})
    retrieval = stats.get("retrieval", {})
    answer = stats.get("answer", {})

    return EvaluationStatsResponse(
        total_evaluations=stats.get("total_count", 0),
        avg_overall_score=overall.get("avg"),
        avg_retrieval_score=retrieval.get("avg_score"),
        avg_answer_score=answer.get("avg_score"),
        avg_context_relevance=retrieval.get("avg_context_relevance"),
        avg_context_precision=retrieval.get("avg_context_precision"),
        avg_context_coverage=retrieval.get("avg_context_coverage"),
        avg_faithfulness=answer.get("avg_faithfulness"),
        avg_answer_relevance=answer.get("avg_relevance"),
        avg_completeness=answer.get("avg_completeness"),
        excellent_count=distribution.get("excellent", 0),
        good_count=distribution.get("good", 0),
        moderate_count=distribution.get("moderate", 0),
        poor_count=distribution.get("poor", 0),
        period_days=days,
    )


# ============================================================================
# Evaluation Execution Endpoints
# ============================================================================


@router.post(
    "/evaluate",
    response_model=EvaluationResultResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Evaluate a Q&A pair",
    description="Run LLM-as-judge evaluation on a query, answer, and retrieved chunks.",
)
async def evaluate_qa_pair(
    request: EvaluateRequest,
    db: DbSession,
    settings_repo: SettingsRepo,
) -> EvaluationResultResponse:
    """Evaluate a single Q&A pair using an LLM judge.

    This endpoint accepts a query, generated answer, and the chunks used to
    generate that answer. It returns detailed evaluation metrics including:

    - **Retrieval metrics**: context relevance, precision, coverage
    - **Answer metrics**: faithfulness, relevance, completeness
    - **Ground truth comparison**: similarity to expected answer (if provided)

    The evaluation is performed by the configured LLM judge from settings.
    """
    # Get database settings for configuration
    db_settings = await settings_repo.get()

    # Check if evaluation is enabled (provider set to "disabled" means disabled)
    if db_settings.eval_judge_provider == "disabled":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Evaluation is disabled in settings (eval_judge_provider='disabled')",
        )

    # Use provider from request, or fall back to database settings
    provider = request.provider or db_settings.eval_judge_provider

    # Create evaluation service
    eval_service = EvaluationService(db)

    # Convert chunks to dict format expected by service
    chunks_data = [
        {
            "content": chunk.content,
            "source": chunk.source,
            "metadata": chunk.metadata or {},
        }
        for chunk in request.chunks
    ]

    try:
        # Run evaluation
        result = await eval_service.evaluate_single(
            query=request.query,
            answer=request.answer,
            chunks=chunks_data,
            ground_truth_id=request.ground_truth_id,
            search_query_id=request.search_query_id,
            provider=provider,
            model=request.model,
            # Search configuration
            search_alpha=request.search_alpha,
            search_preset=request.search_preset,
            search_use_reranker=request.search_use_reranker,
            reranker_provider=request.reranker_provider,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
            embedding_model=request.embedding_model,
            answer_model=request.answer_model,
        )

        logger.info(
            f"Evaluation complete: overall={result.overall_score:.2f}, "
            f"retrieval={result.retrieval_score:.2f}, "
            f"answer={result.answer_score:.2f}"
        )

        return EvaluationResultResponse.from_model(result)

    except JudgeUnavailableError as e:
        logger.error(f"Judge unavailable: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except EvaluationError as e:
        logger.error(f"Evaluation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get(
    "/providers",
    response_model=AvailableProvidersResponse,
    summary="List judge providers",
    description="Get list of available and registered LLM judge providers.",
)
async def list_providers() -> AvailableProvidersResponse:
    """Get available LLM judge providers.

    Returns two lists:
    - **available**: Providers that are configured and ready to use
    - **registered**: All registered providers (may not have API keys configured)
    """
    return AvailableProvidersResponse(
        available=EvaluationService.get_available_providers(),
        registered=EvaluationService.get_registered_providers(),
    )
