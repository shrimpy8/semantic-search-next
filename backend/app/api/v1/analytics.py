"""
Analytics API endpoints.

Provides search history, statistics, and trend analysis for the analytics dashboard.
"""

import logging
import time
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import DbSession
from app.api.schemas import (
    SearchHistoryResponse,
    SearchQuerySchema,
    SearchStatsResponse,
    SearchTrendsResponse,
    TopQueriesResponse,
    TopQuerySchema,
    TrendDataPoint,
)
from app.db.repositories.analytics_repo import AnalyticsRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])


# Dependency to get analytics repository
async def get_analytics_repo(db: DbSession) -> AnalyticsRepository:
    """Get analytics repository instance."""
    return AnalyticsRepository(db)


AnalyticsRepo = Annotated[AnalyticsRepository, Query()]


@router.get(
    "/searches",
    response_model=SearchHistoryResponse,
    summary="Get search history",
    description="Retrieve paginated search history with optional filtering by collection and date range.",
)
async def get_search_history(
    db: DbSession,
    limit: int = Query(default=50, ge=1, le=200, description="Maximum results to return"),
    offset: int = Query(default=0, ge=0, description="Number of results to skip"),
    collection_id: UUID | None = Query(default=None, description="Filter by collection ID"),
    start_date: datetime | None = Query(default=None, description="Filter from date (ISO format)"),
    end_date: datetime | None = Query(default=None, description="Filter to date (ISO format)"),
) -> SearchHistoryResponse:
    """Get paginated search history."""
    start_time = time.perf_counter()

    repo = AnalyticsRepository(db)

    try:
        queries, total = await repo.get_search_history(
            limit=limit,
            offset=offset,
            collection_id=collection_id,
            start_date=start_date,
            end_date=end_date,
        )

        # Convert to response schema
        data = [SearchQuerySchema.model_validate(q) for q in queries]

        latency_ms = int((time.perf_counter() - start_time) * 1000)
        logger.info(
            f"Search history retrieved: {len(data)} results, total={total}, latency={latency_ms}ms"
        )

        return SearchHistoryResponse(
            data=data,
            total=total,
            limit=limit,
            offset=offset,
            has_more=(offset + len(data)) < total,
        )

    except Exception as e:
        logger.error(f"Failed to retrieve search history: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve search history: {str(e)}",
        )


@router.get(
    "/stats",
    response_model=SearchStatsResponse,
    summary="Get search statistics",
    description="Get aggregated search statistics including total searches, average latency, and success rate.",
)
async def get_search_stats(
    db: DbSession,
    collection_id: UUID | None = Query(default=None, description="Filter by collection ID"),
    days: int = Query(default=30, ge=1, le=365, description="Number of days to include"),
) -> SearchStatsResponse:
    """Get aggregated search statistics."""
    start_time = time.perf_counter()

    repo = AnalyticsRepository(db)

    try:
        stats = await repo.get_search_stats(
            collection_id=collection_id,
            days=days,
        )

        latency_ms = int((time.perf_counter() - start_time) * 1000)
        logger.info(f"Search stats retrieved: {stats['total_searches']} searches, latency={latency_ms}ms")

        return SearchStatsResponse(**stats)

    except Exception as e:
        logger.error(f"Failed to retrieve search stats: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve search statistics: {str(e)}",
        )


@router.get(
    "/trends",
    response_model=SearchTrendsResponse,
    summary="Get search trends",
    description="Get time-series search trends showing search volume and latency over time.",
)
async def get_search_trends(
    db: DbSession,
    collection_id: UUID | None = Query(default=None, description="Filter by collection ID"),
    days: int = Query(default=30, ge=1, le=365, description="Number of days to include"),
    granularity: str = Query(
        default="day",
        pattern="^(hour|day|week)$",
        description="Time granularity: 'hour', 'day', or 'week'",
    ),
) -> SearchTrendsResponse:
    """Get time-series search trends."""
    start_time = time.perf_counter()

    repo = AnalyticsRepository(db)

    try:
        trends = await repo.get_search_trends(
            collection_id=collection_id,
            days=days,
            granularity=granularity,
        )

        # Convert to response schema
        data = [TrendDataPoint(**t) for t in trends]

        latency_ms = int((time.perf_counter() - start_time) * 1000)
        logger.info(f"Search trends retrieved: {len(data)} data points, latency={latency_ms}ms")

        return SearchTrendsResponse(
            data=data,
            granularity=granularity,
            period_days=days,
        )

    except Exception as e:
        logger.error(f"Failed to retrieve search trends: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve search trends: {str(e)}",
        )


@router.get(
    "/top-queries",
    response_model=TopQueriesResponse,
    summary="Get top search queries",
    description="Get most frequently searched queries with their statistics.",
)
async def get_top_queries(
    db: DbSession,
    limit: int = Query(default=10, ge=1, le=50, description="Maximum queries to return"),
    collection_id: UUID | None = Query(default=None, description="Filter by collection ID"),
    days: int = Query(default=30, ge=1, le=365, description="Number of days to include"),
) -> TopQueriesResponse:
    """Get most frequent search queries."""
    start_time = time.perf_counter()

    repo = AnalyticsRepository(db)

    try:
        top_queries = await repo.get_top_queries(
            limit=limit,
            collection_id=collection_id,
            days=days,
        )

        # Convert to response schema
        data = [TopQuerySchema(**q) for q in top_queries]

        latency_ms = int((time.perf_counter() - start_time) * 1000)
        logger.info(f"Top queries retrieved: {len(data)} queries, latency={latency_ms}ms")

        return TopQueriesResponse(
            data=data,
            period_days=days,
        )

    except Exception as e:
        logger.error(f"Failed to retrieve top queries: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve top queries: {str(e)}",
        )
