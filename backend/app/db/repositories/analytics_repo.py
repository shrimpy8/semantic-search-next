"""Analytics repository for search history and statistics."""

import logging
from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import SearchQuery
from app.db.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class AnalyticsRepository(BaseRepository[SearchQuery]):
    """
    Repository for analytics data access.

    Provides methods to retrieve search history, aggregate statistics,
    and time-series trends for the analytics dashboard.
    """

    def __init__(self, session: AsyncSession):
        super().__init__(SearchQuery, session)

    async def get_search_history(
        self,
        limit: int = 50,
        offset: int = 0,
        collection_id: UUID | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> tuple[Sequence[SearchQuery], int]:
        """
        Get paginated search history with optional filtering.

        Args:
            limit: Maximum number of records to return
            offset: Number of records to skip
            collection_id: Filter by collection (optional)
            start_date: Filter from date (optional)
            end_date: Filter to date (optional)

        Returns:
            Tuple of (search_queries, total_count)
        """
        logger.debug(
            f"Fetching search history: limit={limit}, offset={offset}, "
            f"collection_id={collection_id}, start_date={start_date}, end_date={end_date}"
        )

        # Build base query
        conditions: list[Any] = []

        if collection_id:
            conditions.append(SearchQuery.collection_id == collection_id)

        if start_date:
            conditions.append(SearchQuery.created_at >= start_date)

        if end_date:
            conditions.append(SearchQuery.created_at <= end_date)

        # Query for results
        stmt = select(SearchQuery).order_by(desc(SearchQuery.created_at))

        if conditions:
            stmt = stmt.where(and_(*conditions))

        stmt = stmt.limit(limit).offset(offset)

        result = await self.session.execute(stmt)
        queries = result.scalars().all()

        # Count total matching records
        count_stmt = select(func.count()).select_from(SearchQuery)
        if conditions:
            count_stmt = count_stmt.where(and_(*conditions))

        count_result = await self.session.execute(count_stmt)
        total_count = count_result.scalar() or 0

        logger.info(f"Retrieved {len(queries)} search queries (total: {total_count})")

        return queries, total_count

    async def get_search_stats(
        self,
        collection_id: UUID | None = None,
        days: int = 30,
    ) -> dict[str, Any]:
        """
        Get aggregated search statistics.

        Args:
            collection_id: Filter by collection (optional)
            days: Number of days to include in stats

        Returns:
            Dictionary with aggregate statistics
        """
        logger.debug(f"Calculating search stats: collection_id={collection_id}, days={days}")

        cutoff_date = datetime.utcnow() - timedelta(days=days)

        conditions: list[Any] = [SearchQuery.created_at >= cutoff_date]
        if collection_id:
            conditions.append(SearchQuery.collection_id == collection_id)

        # Total searches
        total_stmt = select(func.count()).select_from(SearchQuery).where(and_(*conditions))
        total_result = await self.session.execute(total_stmt)
        total_searches = total_result.scalar() or 0

        # Average latency
        avg_latency_stmt = select(func.avg(SearchQuery.latency_ms)).where(
            and_(*conditions, SearchQuery.latency_ms.isnot(None))
        )
        avg_result = await self.session.execute(avg_latency_stmt)
        avg_latency = avg_result.scalar()
        avg_latency_ms = round(avg_latency, 1) if avg_latency else 0.0

        # Success rate (searches with results > 0)
        success_stmt = select(func.count()).select_from(SearchQuery).where(
            and_(*conditions, SearchQuery.results_count > 0)
        )
        success_result = await self.session.execute(success_stmt)
        successful_searches = success_result.scalar() or 0
        success_rate = (successful_searches / total_searches * 100) if total_searches > 0 else 0.0

        # Searches by preset
        preset_stmt = (
            select(
                SearchQuery.retrieval_method,
                func.count().label("count")
            )
            .where(and_(*conditions))
            .group_by(SearchQuery.retrieval_method)
        )
        preset_result = await self.session.execute(preset_stmt)
        presets = {row[0] or "unknown": row[1] for row in preset_result.all()}

        # Searches with zero results (potential issues)
        zero_results_stmt = select(func.count()).select_from(SearchQuery).where(
            and_(*conditions, SearchQuery.results_count == 0)
        )
        zero_result = await self.session.execute(zero_results_stmt)
        zero_results_count = zero_result.scalar() or 0

        stats: dict[str, Any] = {
            "total_searches": total_searches,
            "avg_latency_ms": avg_latency_ms,
            "success_rate": round(success_rate, 1),
            "successful_searches": successful_searches,
            "zero_results_count": zero_results_count,
            "searches_by_preset": presets,
            "period_days": days,
        }

        logger.info(f"Search stats: {total_searches} total, {avg_latency_ms}ms avg, {success_rate:.1f}% success")

        return stats

    async def get_search_trends(
        self,
        collection_id: UUID | None = None,
        days: int = 30,
        granularity: str = "day",
    ) -> list[dict[str, Any]]:
        """
        Get time-series search trends.

        Args:
            collection_id: Filter by collection (optional)
            days: Number of days to include
            granularity: 'day', 'week', or 'hour'

        Returns:
            List of time-series data points with counts and avg latency
        """
        logger.debug(f"Calculating search trends: days={days}, granularity={granularity}")

        cutoff_date = datetime.utcnow() - timedelta(days=days)

        conditions: list[Any] = [SearchQuery.created_at >= cutoff_date]
        if collection_id:
            conditions.append(SearchQuery.collection_id == collection_id)

        # Determine date truncation based on granularity
        if granularity == "hour":
            date_trunc = func.date_trunc("hour", SearchQuery.created_at)
        elif granularity == "week":
            date_trunc = func.date_trunc("week", SearchQuery.created_at)
        else:  # default to day
            date_trunc = func.date_trunc("day", SearchQuery.created_at)

        # Query for trends
        stmt = (
            select(
                date_trunc.label("period"),
                func.count().label("search_count"),
                func.avg(SearchQuery.latency_ms).label("avg_latency"),
            )
            .where(and_(*conditions))
            .group_by(date_trunc)
            .order_by(date_trunc)
        )

        result = await self.session.execute(stmt)

        trends: list[dict[str, Any]] = []
        for row in result.all():
            trends.append({
                "period": row.period.isoformat() if row.period else None,
                "search_count": row.search_count,
                "avg_latency_ms": round(row.avg_latency, 1) if row.avg_latency else 0,
            })

        logger.info(f"Retrieved {len(trends)} trend data points")

        return trends

    async def get_top_queries(
        self,
        limit: int = 10,
        collection_id: UUID | None = None,
        days: int = 30,
    ) -> list[dict[str, Any]]:
        """
        Get most frequent search queries.

        Args:
            limit: Maximum number of queries to return
            collection_id: Filter by collection (optional)
            days: Number of days to include

        Returns:
            List of top queries with counts
        """
        logger.debug(f"Getting top queries: limit={limit}, days={days}")

        cutoff_date = datetime.utcnow() - timedelta(days=days)

        conditions: list[Any] = [SearchQuery.created_at >= cutoff_date]
        if collection_id:
            conditions.append(SearchQuery.collection_id == collection_id)

        stmt = (
            select(
                SearchQuery.query_text,
                func.count().label("count"),
                func.avg(SearchQuery.latency_ms).label("avg_latency"),
                func.avg(SearchQuery.results_count).label("avg_results"),
            )
            .where(and_(*conditions))
            .group_by(SearchQuery.query_text)
            .order_by(desc(func.count()))
            .limit(limit)
        )

        result = await self.session.execute(stmt)

        top_queries: list[dict[str, Any]] = []
        for row in result.all():
            top_queries.append({
                "query": row.query_text[:100],  # Truncate long queries
                "count": row.count,
                "avg_latency_ms": round(row.avg_latency, 1) if row.avg_latency else 0,
                "avg_results": round(row.avg_results, 1) if row.avg_results else 0,
            })

        logger.info(f"Retrieved {len(top_queries)} top queries")

        return top_queries
