"""Evaluation repository for database operations."""

import logging
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import EvaluationResult, EvaluationRun, GroundTruth
from app.db.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class GroundTruthRepository(BaseRepository[GroundTruth]):
    """Repository for GroundTruth CRUD operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(GroundTruth, session)

    async def get_by_collection(
        self,
        collection_id: UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[GroundTruth]:
        """Get all ground truths for a collection."""
        stmt = (
            select(GroundTruth)
            .where(GroundTruth.collection_id == collection_id)
            .order_by(GroundTruth.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_collection_and_query(
        self,
        collection_id: UUID,
        query: str,
    ) -> GroundTruth | None:
        """Get a ground truth by collection and exact query match."""
        stmt = select(GroundTruth).where(
            GroundTruth.collection_id == collection_id,
            GroundTruth.query == query,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def search_by_query(
        self,
        collection_id: UUID,
        query_substring: str,
        limit: int = 10,
    ) -> Sequence[GroundTruth]:
        """Search ground truths by query substring (case-insensitive)."""
        stmt = (
            select(GroundTruth)
            .where(
                GroundTruth.collection_id == collection_id,
                GroundTruth.query.ilike(f"%{query_substring}%"),
            )
            .order_by(GroundTruth.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_by_collection(self, collection_id: UUID) -> int:
        """Count ground truths for a collection."""
        stmt = select(func.count()).where(GroundTruth.collection_id == collection_id)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def delete_by_collection(self, collection_id: UUID) -> int:
        """Delete all ground truths for a collection. Returns count deleted."""
        # Get count first
        count = await self.count_by_collection(collection_id)
        if count == 0:
            return 0

        stmt = select(GroundTruth).where(GroundTruth.collection_id == collection_id)
        result = await self.session.execute(stmt)
        ground_truths = result.scalars().all()

        for gt in ground_truths:
            await self.session.delete(gt)

        await self.session.flush()
        logger.info(f"Deleted {count} ground truths for collection {collection_id}")
        return count

    async def list_with_pagination(
        self,
        collection_id: UUID | None = None,
        limit: int = 10,
        starting_after: UUID | None = None,
    ) -> tuple[Sequence[GroundTruth], bool]:
        """
        List ground truths with cursor-based pagination.

        Args:
            collection_id: Optional filter by collection
            limit: Max results to return
            starting_after: Cursor for pagination

        Returns:
            Tuple of (ground_truths, has_more)
        """
        stmt = select(GroundTruth).order_by(GroundTruth.created_at.desc())

        if collection_id:
            stmt = stmt.where(GroundTruth.collection_id == collection_id)

        if starting_after:
            cursor_stmt = select(GroundTruth.created_at).where(
                GroundTruth.id == starting_after
            )
            cursor_result = await self.session.execute(cursor_stmt)
            cursor_created_at = cursor_result.scalar_one_or_none()

            if cursor_created_at:
                stmt = stmt.where(GroundTruth.created_at < cursor_created_at)

        stmt = stmt.limit(limit + 1)
        result = await self.session.execute(stmt)
        ground_truths = list(result.scalars().all())

        has_more = len(ground_truths) > limit
        if has_more:
            ground_truths = ground_truths[:limit]

        return ground_truths, has_more


class EvaluationResultRepository(BaseRepository[EvaluationResult]):
    """Repository for EvaluationResult CRUD operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(EvaluationResult, session)

    async def get_with_relations(self, id: UUID) -> EvaluationResult | None:
        """Get evaluation result with related ground truth loaded."""
        stmt = (
            select(EvaluationResult)
            .options(selectinload(EvaluationResult.ground_truth))
            .where(EvaluationResult.id == id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_search_query(
        self,
        search_query_id: UUID,
    ) -> Sequence[EvaluationResult]:
        """Get all evaluations for a search query."""
        stmt = (
            select(EvaluationResult)
            .where(EvaluationResult.search_query_id == search_query_id)
            .order_by(EvaluationResult.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_ground_truth(
        self,
        ground_truth_id: UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[EvaluationResult]:
        """Get all evaluations for a ground truth."""
        stmt = (
            select(EvaluationResult)
            .where(EvaluationResult.ground_truth_id == ground_truth_id)
            .order_by(EvaluationResult.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_evaluation_run(
        self,
        evaluation_run_id: UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[EvaluationResult]:
        """Get all results for an evaluation run."""
        stmt = (
            select(EvaluationResult)
            .where(EvaluationResult.evaluation_run_id == evaluation_run_id)
            .order_by(EvaluationResult.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def list_with_pagination(
        self,
        evaluation_run_id: UUID | None = None,
        ground_truth_id: UUID | None = None,
        min_score: float | None = None,
        max_score: float | None = None,
        limit: int = 10,
        starting_after: UUID | None = None,
    ) -> tuple[Sequence[EvaluationResult], bool]:
        """
        List evaluation results with cursor-based pagination and filters.

        Args:
            evaluation_run_id: Optional filter by evaluation run
            ground_truth_id: Optional filter by ground truth
            min_score: Optional minimum overall_score filter
            max_score: Optional maximum overall_score filter
            limit: Max results to return
            starting_after: Cursor for pagination

        Returns:
            Tuple of (results, has_more)
        """
        stmt = select(EvaluationResult).order_by(EvaluationResult.created_at.desc())

        if evaluation_run_id:
            stmt = stmt.where(EvaluationResult.evaluation_run_id == evaluation_run_id)

        if ground_truth_id:
            stmt = stmt.where(EvaluationResult.ground_truth_id == ground_truth_id)

        if min_score is not None:
            stmt = stmt.where(EvaluationResult.overall_score >= min_score)

        if max_score is not None:
            stmt = stmt.where(EvaluationResult.overall_score <= max_score)

        if starting_after:
            cursor_stmt = select(EvaluationResult.created_at).where(
                EvaluationResult.id == starting_after
            )
            cursor_result = await self.session.execute(cursor_stmt)
            cursor_created_at = cursor_result.scalar_one_or_none()

            if cursor_created_at:
                stmt = stmt.where(EvaluationResult.created_at < cursor_created_at)

        stmt = stmt.limit(limit + 1)
        result = await self.session.execute(stmt)
        results = list(result.scalars().all())

        has_more = len(results) > limit
        if has_more:
            results = results[:limit]

        return results, has_more

    async def get_aggregate_stats(
        self,
        evaluation_run_id: UUID | None = None,
        ground_truth_id: UUID | None = None,
        start_date: datetime | None = None,
    ) -> dict[str, Any]:
        """
        Get aggregate statistics for evaluation results.

        Args:
            evaluation_run_id: Optional filter by evaluation run
            ground_truth_id: Optional filter by ground truth
            start_date: Optional filter by start date

        Returns:
            Dictionary with aggregate stats
        """
        # Build base query for counting
        count_stmt = select(func.count()).select_from(EvaluationResult)

        # Build base query for aggregates
        avg_stmt = select(
            func.count().label("total_count"),
            func.avg(EvaluationResult.overall_score).label("avg_overall_score"),
            func.avg(EvaluationResult.retrieval_score).label("avg_retrieval_score"),
            func.avg(EvaluationResult.answer_score).label("avg_answer_score"),
            func.avg(EvaluationResult.context_relevance).label("avg_context_relevance"),
            func.avg(EvaluationResult.context_precision).label("avg_context_precision"),
            func.avg(EvaluationResult.context_coverage).label("avg_context_coverage"),
            func.avg(EvaluationResult.faithfulness).label("avg_faithfulness"),
            func.avg(EvaluationResult.answer_relevance).label("avg_answer_relevance"),
            func.avg(EvaluationResult.completeness).label("avg_completeness"),
            func.avg(EvaluationResult.ground_truth_similarity).label(
                "avg_ground_truth_similarity"
            ),
            func.min(EvaluationResult.overall_score).label("min_overall_score"),
            func.max(EvaluationResult.overall_score).label("max_overall_score"),
            func.avg(EvaluationResult.eval_latency_ms).label("avg_latency_ms"),
        )

        # Apply filters
        if evaluation_run_id:
            count_stmt = count_stmt.where(
                EvaluationResult.evaluation_run_id == evaluation_run_id
            )
            avg_stmt = avg_stmt.where(
                EvaluationResult.evaluation_run_id == evaluation_run_id
            )

        if ground_truth_id:
            count_stmt = count_stmt.where(
                EvaluationResult.ground_truth_id == ground_truth_id
            )
            avg_stmt = avg_stmt.where(
                EvaluationResult.ground_truth_id == ground_truth_id
            )

        if start_date:
            count_stmt = count_stmt.where(EvaluationResult.created_at >= start_date)
            avg_stmt = avg_stmt.where(EvaluationResult.created_at >= start_date)

        # Execute queries
        result = await self.session.execute(avg_stmt)
        row = result.one()

        # Count errors
        error_stmt = (
            select(func.count())
            .select_from(EvaluationResult)
            .where(EvaluationResult.error_message.isnot(None))
        )
        if evaluation_run_id:
            error_stmt = error_stmt.where(
                EvaluationResult.evaluation_run_id == evaluation_run_id
            )
        if ground_truth_id:
            error_stmt = error_stmt.where(
                EvaluationResult.ground_truth_id == ground_truth_id
            )
        if start_date:
            error_stmt = error_stmt.where(EvaluationResult.created_at >= start_date)

        error_result = await self.session.execute(error_stmt)
        error_count = error_result.scalar() or 0

        return {
            "total_count": row.total_count or 0,
            "error_count": error_count,
            "overall_score": {
                "avg": float(row.avg_overall_score) if row.avg_overall_score else None,
                "min": float(row.min_overall_score) if row.min_overall_score else None,
                "max": float(row.max_overall_score) if row.max_overall_score else None,
            },
            "retrieval": {
                "avg_score": (
                    float(row.avg_retrieval_score) if row.avg_retrieval_score else None
                ),
                "avg_context_relevance": (
                    float(row.avg_context_relevance)
                    if row.avg_context_relevance
                    else None
                ),
                "avg_context_precision": (
                    float(row.avg_context_precision)
                    if row.avg_context_precision
                    else None
                ),
                "avg_context_coverage": (
                    float(row.avg_context_coverage)
                    if row.avg_context_coverage
                    else None
                ),
            },
            "answer": {
                "avg_score": (
                    float(row.avg_answer_score) if row.avg_answer_score else None
                ),
                "avg_faithfulness": (
                    float(row.avg_faithfulness) if row.avg_faithfulness else None
                ),
                "avg_relevance": (
                    float(row.avg_answer_relevance)
                    if row.avg_answer_relevance
                    else None
                ),
                "avg_completeness": (
                    float(row.avg_completeness) if row.avg_completeness else None
                ),
            },
            "ground_truth": {
                "avg_similarity": (
                    float(row.avg_ground_truth_similarity)
                    if row.avg_ground_truth_similarity
                    else None
                ),
            },
            "performance": {
                "avg_latency_ms": (
                    float(row.avg_latency_ms) if row.avg_latency_ms else None
                ),
            },
        }

    async def get_score_distribution(
        self,
        evaluation_run_id: UUID | None = None,
        start_date: datetime | None = None,
    ) -> dict[str, int]:
        """
        Get distribution of overall scores into quality categories.

        Args:
            evaluation_run_id: Optional filter by evaluation run
            start_date: Optional filter by start date

        Returns:
            Dictionary with counts for excellent, good, moderate, poor categories
        """
        # Define score thresholds per the plan
        # > 0.8 = excellent, 0.6-0.8 = good, 0.4-0.6 = moderate, < 0.4 = poor
        distribution = {"excellent": 0, "good": 0, "moderate": 0, "poor": 0}

        # Excellent: > 0.8
        excellent_stmt = select(func.count()).where(
            EvaluationResult.overall_score > 0.8
        )
        if evaluation_run_id:
            excellent_stmt = excellent_stmt.where(
                EvaluationResult.evaluation_run_id == evaluation_run_id
            )
        if start_date:
            excellent_stmt = excellent_stmt.where(
                EvaluationResult.created_at >= start_date
            )
        result = await self.session.execute(excellent_stmt)
        distribution["excellent"] = result.scalar() or 0

        # Good: 0.6-0.8
        good_stmt = select(func.count()).where(
            EvaluationResult.overall_score > 0.6,
            EvaluationResult.overall_score <= 0.8,
        )
        if evaluation_run_id:
            good_stmt = good_stmt.where(
                EvaluationResult.evaluation_run_id == evaluation_run_id
            )
        if start_date:
            good_stmt = good_stmt.where(EvaluationResult.created_at >= start_date)
        result = await self.session.execute(good_stmt)
        distribution["good"] = result.scalar() or 0

        # Moderate: 0.4-0.6
        moderate_stmt = select(func.count()).where(
            EvaluationResult.overall_score > 0.4,
            EvaluationResult.overall_score <= 0.6,
        )
        if evaluation_run_id:
            moderate_stmt = moderate_stmt.where(
                EvaluationResult.evaluation_run_id == evaluation_run_id
            )
        if start_date:
            moderate_stmt = moderate_stmt.where(
                EvaluationResult.created_at >= start_date
            )
        result = await self.session.execute(moderate_stmt)
        distribution["moderate"] = result.scalar() or 0

        # Poor: <= 0.4
        poor_stmt = select(func.count()).where(EvaluationResult.overall_score <= 0.4)
        if evaluation_run_id:
            poor_stmt = poor_stmt.where(
                EvaluationResult.evaluation_run_id == evaluation_run_id
            )
        if start_date:
            poor_stmt = poor_stmt.where(EvaluationResult.created_at >= start_date)
        result = await self.session.execute(poor_stmt)
        distribution["poor"] = result.scalar() or 0

        return distribution


class EvaluationRunRepository(BaseRepository[EvaluationRun]):
    """Repository for EvaluationRun CRUD operations (Phase 2)."""

    def __init__(self, session: AsyncSession):
        super().__init__(EvaluationRun, session)

    async def get_by_status(
        self,
        status: str,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[EvaluationRun]:
        """Get evaluation runs by status."""
        stmt = (
            select(EvaluationRun)
            .where(EvaluationRun.status == status)
            .order_by(EvaluationRun.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_collection(
        self,
        collection_id: UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[EvaluationRun]:
        """Get evaluation runs for a collection."""
        stmt = (
            select(EvaluationRun)
            .where(EvaluationRun.collection_id == collection_id)
            .order_by(EvaluationRun.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def update_progress(
        self,
        run_id: UUID,
        completed_count: int,
        failed_count: int = 0,
    ) -> EvaluationRun | None:
        """Update progress counters for an evaluation run."""
        run = await self.get_by_id(run_id)
        if run:
            run.completed_count = completed_count
            run.failed_count = failed_count
            await self.session.flush()
            await self.session.refresh(run)
        return run

    async def mark_started(self, run_id: UUID) -> EvaluationRun | None:
        """Mark an evaluation run as started."""
        run = await self.get_by_id(run_id)
        if run:
            run.status = "running"
            run.started_at = datetime.now(UTC)
            await self.session.flush()
            await self.session.refresh(run)
        return run

    async def mark_completed(self, run_id: UUID) -> EvaluationRun | None:
        """Mark an evaluation run as completed."""
        run = await self.get_by_id(run_id)
        if run:
            run.status = "completed"
            run.completed_at = datetime.now(UTC)
            await self.session.flush()
            await self.session.refresh(run)
        return run

    async def mark_failed(
        self, run_id: UUID, error_message: str
    ) -> EvaluationRun | None:
        """Mark an evaluation run as failed with error message."""
        run = await self.get_by_id(run_id)
        if run:
            run.status = "failed"
            run.completed_at = datetime.now(UTC)
            run.error_message = error_message
            await self.session.flush()
            await self.session.refresh(run)
        return run

    async def list_with_pagination(
        self,
        collection_id: UUID | None = None,
        status: str | None = None,
        limit: int = 10,
        starting_after: UUID | None = None,
    ) -> tuple[Sequence[EvaluationRun], bool]:
        """
        List evaluation runs with cursor-based pagination.

        Args:
            collection_id: Optional filter by collection
            status: Optional filter by status
            limit: Max results to return
            starting_after: Cursor for pagination

        Returns:
            Tuple of (runs, has_more)
        """
        stmt = select(EvaluationRun).order_by(EvaluationRun.created_at.desc())

        if collection_id:
            stmt = stmt.where(EvaluationRun.collection_id == collection_id)

        if status:
            stmt = stmt.where(EvaluationRun.status == status)

        if starting_after:
            cursor_stmt = select(EvaluationRun.created_at).where(
                EvaluationRun.id == starting_after
            )
            cursor_result = await self.session.execute(cursor_stmt)
            cursor_created_at = cursor_result.scalar_one_or_none()

            if cursor_created_at:
                stmt = stmt.where(EvaluationRun.created_at < cursor_created_at)

        stmt = stmt.limit(limit + 1)
        result = await self.session.execute(stmt)
        runs = list(result.scalars().all())

        has_more = len(runs) > limit
        if has_more:
            runs = runs[:limit]

        return runs, has_more
