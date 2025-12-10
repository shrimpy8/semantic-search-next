"""Evaluation service for running LLM-based evaluations."""

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import EvaluationError, JudgeUnavailableError
from app.core.llm_judge import EvaluationResult as JudgeEvalResult
from app.core.llm_judge import JudgeFactory
from app.db.models import EvaluationResult, GroundTruth, SearchQuery
from app.db.repositories.eval_repo import (
    EvaluationResultRepository,
    GroundTruthRepository,
)

logger = logging.getLogger(__name__)


class EvaluationService:
    """Service for running evaluations on search queries.

    Configuration:
    - Evaluation enable/disable is controlled via DB Settings (eval_judge_provider).
      Setting eval_judge_provider to "disabled" disables evaluation.
    - Provider/model selection comes from API request or DB Settings defaults.
    """

    def __init__(self, session: AsyncSession):
        """Initialize evaluation service.

        Args:
            session: Database session
        """
        self.session = session
        self.eval_repo = EvaluationResultRepository(session)
        self.ground_truth_repo = GroundTruthRepository(session)

    async def evaluate_single(
        self,
        query: str,
        answer: str,
        chunks: list[dict],
        ground_truth_id: UUID | None = None,
        search_query_id: UUID | None = None,
        provider: str | None = None,
        model: str | None = None,
        # Search configuration fields
        search_alpha: float | None = None,
        search_preset: str | None = None,
        search_use_reranker: bool | None = None,
        reranker_provider: str | None = None,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        embedding_model: str | None = None,
        answer_model: str | None = None,
    ) -> EvaluationResult:
        """Evaluate a single Q&A pair.

        Args:
            query: The search query
            answer: The generated answer
            chunks: Retrieved chunks used for the answer
            ground_truth_id: Optional ground truth ID for comparison
            search_query_id: Optional search query ID to link to
            provider: Optional judge provider (defaults to config)
            model: Optional judge model (defaults to config)
            search_alpha: Semantic weight used (0-1)
            search_preset: Search preset used
            search_use_reranker: Whether reranking was enabled
            reranker_provider: Reranker provider used
            chunk_size: Document chunk size
            chunk_overlap: Chunk overlap size

        Returns:
            EvaluationResult database model with all metrics

        Raises:
            EvaluationError: If evaluation fails
            JudgeUnavailableError: If judge is not available
        """
        # Note: Evaluation enable/disable check moved to API layer
        # to use DB Settings (eval_judge_provider != "disabled")

        # Get ground truth if provided
        expected_answer = None
        if ground_truth_id:
            ground_truth = await self.ground_truth_repo.get_by_id(ground_truth_id)
            if ground_truth:
                expected_answer = ground_truth.expected_answer
            else:
                logger.warning(f"Ground truth {ground_truth_id} not found")

        # Create judge
        try:
            judge = JudgeFactory.create(provider=provider, model=model)
        except JudgeUnavailableError:
            logger.error(f"Judge provider '{provider or 'default'}' not available")
            raise

        logger.info(
            f"Running evaluation with {judge.provider_name}/{judge.model_name} "
            f"on query: {query[:50]}..."
        )

        # Run evaluation
        eval_result: JudgeEvalResult = await judge.evaluate(
            query=query,
            answer=answer,
            chunks=chunks,
            expected_answer=expected_answer,
        )

        # Create database record
        db_result = EvaluationResult(
            search_query_id=search_query_id,
            ground_truth_id=ground_truth_id,
            query=query,
            generated_answer=answer,
            expected_answer=expected_answer,
            retrieved_chunks=chunks,
            judge_provider=judge.provider_name,
            judge_model=judge.model_name,
            # Retrieval metrics
            context_relevance=eval_result.context_relevance,
            context_precision=eval_result.context_precision,
            context_coverage=eval_result.context_coverage,
            # Answer metrics
            faithfulness=eval_result.faithfulness,
            answer_relevance=eval_result.answer_relevance,
            completeness=eval_result.completeness,
            # Ground truth comparison
            ground_truth_similarity=eval_result.ground_truth_similarity,
            # Aggregate scores
            retrieval_score=eval_result.retrieval_score,
            answer_score=eval_result.answer_score,
            overall_score=eval_result.overall_score,
            # Search configuration (captured at evaluation time)
            search_alpha=search_alpha,
            search_preset=search_preset,
            search_use_reranker=search_use_reranker,
            reranker_provider=reranker_provider,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            embedding_model=embedding_model,
            answer_model=answer_model,
            # Raw response and metadata
            raw_eval_response={
                "retrieval_reasoning": eval_result.retrieval_reasoning,
                "answer_reasoning": eval_result.answer_reasoning,
            },
            eval_latency_ms=eval_result.latency_ms,
            error_message=eval_result.error_message,
        )

        # Save to database
        created = await self.eval_repo.create(db_result)
        await self.session.commit()
        await self.session.refresh(created)

        log_msg = (
            f"Evaluation complete: overall={eval_result.overall_score:.2f}, "
            f"retrieval={eval_result.retrieval_score:.2f}, "
            f"answer={eval_result.answer_score:.2f}, "
            f"latency={eval_result.latency_ms}ms"
        )
        if eval_result.error_message:
            logger.warning(f"{log_msg} (with error: {eval_result.error_message})")
        else:
            logger.info(log_msg)

        return created

    async def evaluate_search_query(
        self,
        search_query: SearchQuery,
        ground_truth_id: UUID | None = None,
        provider: str | None = None,
        model: str | None = None,
    ) -> EvaluationResult:
        """Evaluate an existing search query.

        Args:
            search_query: SearchQuery model with stored chunks and answer
            ground_truth_id: Optional ground truth ID for comparison
            provider: Optional judge provider
            model: Optional judge model

        Returns:
            EvaluationResult database model

        Raises:
            EvaluationError: If search query is missing required data
        """
        if not search_query.generated_answer:
            raise EvaluationError(
                f"Search query {search_query.id} has no generated answer"
            )

        if not search_query.retrieved_chunks:
            raise EvaluationError(
                f"Search query {search_query.id} has no retrieved chunks"
            )

        return await self.evaluate_single(
            query=search_query.query,
            answer=search_query.generated_answer,
            chunks=search_query.retrieved_chunks,
            ground_truth_id=ground_truth_id,
            search_query_id=search_query.id,
            provider=provider,
            model=model,
        )

    async def find_matching_ground_truth(
        self,
        query: str,
        collection_id: UUID,
    ) -> GroundTruth | None:
        """Find a ground truth matching the query (exact match).

        Args:
            query: The search query
            collection_id: Collection to search in

        Returns:
            Matching GroundTruth or None
        """
        return await self.ground_truth_repo.get_by_collection_and_query(
            collection_id=collection_id,
            query=query,
        )

    @staticmethod
    def get_available_providers() -> list[str]:
        """Get list of available judge providers."""
        return JudgeFactory.get_available_providers()

    @staticmethod
    def get_registered_providers() -> list[str]:
        """Get list of registered judge providers."""
        return JudgeFactory.get_registered_providers()
