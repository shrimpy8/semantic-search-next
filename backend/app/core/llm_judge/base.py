"""Base LLM Judge interface and dataclasses."""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path

import yaml  # type: ignore[import-untyped]

logger = logging.getLogger(__name__)

# Shared prompts path for all judge implementations
PROMPTS_PATH = Path(__file__).parent.parent.parent / "prompts" / "evaluation.yaml"


def load_prompts() -> dict:
    """Load evaluation prompts from YAML file.

    Returns:
        Dictionary containing evaluation prompts for retrieval, answer, and ground truth.
    """
    with open(PROMPTS_PATH) as f:
        return yaml.safe_load(f)


@dataclass
class RetrievalEvalResult:
    """Result of evaluating retrieval quality."""

    context_relevance: float  # 0-1: Are retrieved chunks relevant to query?
    context_precision: float  # 0-1: Are top results more relevant than lower?
    context_coverage: float  # 0-1: Do chunks cover all query aspects?
    reasoning: str = ""  # Explanation from judge


@dataclass
class AnswerEvalResult:
    """Result of evaluating answer quality."""

    faithfulness: float  # 0-1: Is answer grounded in context?
    answer_relevance: float  # 0-1: Does answer address the question?
    completeness: float  # 0-1: Does answer cover all aspects?
    ground_truth_similarity: float | None = None  # 0-1: Similarity to expected
    reasoning: str = ""  # Explanation from judge


@dataclass
class EvaluationResult:
    """Combined evaluation result with all metrics."""

    # Retrieval metrics
    context_relevance: float
    context_precision: float
    context_coverage: float

    # Answer metrics
    faithfulness: float
    answer_relevance: float
    completeness: float

    # Ground truth comparison (optional)
    ground_truth_similarity: float | None = None

    # Aggregate scores
    retrieval_score: float = 0.0
    answer_score: float = 0.0
    overall_score: float = 0.0

    # Raw response from judge
    raw_response: dict = field(default_factory=dict)

    # Reasoning from judge
    retrieval_reasoning: str = ""
    answer_reasoning: str = ""

    # Evaluation metadata
    latency_ms: int = 0
    error_message: str | None = None

    def __post_init__(self):
        """Calculate aggregate scores after initialization."""
        # Retrieval score: weighted average of retrieval metrics
        # Weights: relevance 40%, precision 30%, coverage 30%
        self.retrieval_score = (
            self.context_relevance * 0.4
            + self.context_precision * 0.3
            + self.context_coverage * 0.3
        )

        # Answer score: weighted average of answer metrics
        # Weights: faithfulness 50%, relevance 30%, completeness 20%
        self.answer_score = (
            self.faithfulness * 0.5
            + self.answer_relevance * 0.3
            + self.completeness * 0.2
        )

        # Overall score: weighted average of retrieval and answer
        # Weights: retrieval 40%, answer 60% (answer quality more important)
        self.overall_score = self.retrieval_score * 0.4 + self.answer_score * 0.6


class BaseLLMJudge(ABC):
    """Abstract base class for LLM judge implementations.

    Defines the interface for evaluating retrieval and answer quality
    using an LLM as a judge.
    """

    def __init__(self, model: str | None = None, timeout: int = 30, max_retries: int = 2):
        """Initialize the judge.

        Args:
            model: Model identifier (e.g., 'gpt-4o-mini')
            timeout: Request timeout in seconds
            max_retries: Maximum retry attempts on failure
        """
        self.model = model or ""
        self.timeout = timeout
        self.max_retries = max_retries

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider name (e.g., 'openai', 'anthropic')."""
        ...

    @property
    def model_name(self) -> str:
        """Return the model name."""
        return self.model

    @abstractmethod
    async def evaluate_retrieval(
        self,
        query: str,
        chunks: list[dict],
    ) -> RetrievalEvalResult:
        """Evaluate the quality of retrieved chunks.

        Args:
            query: The search query
            chunks: List of retrieved chunks with content and metadata

        Returns:
            RetrievalEvalResult with scores and reasoning
        """
        ...

    @abstractmethod
    async def evaluate_answer(
        self,
        query: str,
        answer: str,
        context: str,
        expected_answer: str | None = None,
    ) -> AnswerEvalResult:
        """Evaluate the quality of a generated answer.

        Args:
            query: The original question
            answer: The generated answer
            context: The context used to generate the answer
            expected_answer: Optional ground truth answer for comparison

        Returns:
            AnswerEvalResult with scores and reasoning
        """
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Check if this judge is available (API key configured, etc.)."""
        ...

    @staticmethod
    def _clamp_score(score: float | None) -> float:
        """Clamp score to 0.0-1.0 range.

        Args:
            score: Raw score value (may be None or out of range)

        Returns:
            Score clamped to [0.0, 1.0] range, or 0.0 if None
        """
        if score is None:
            return 0.0
        return max(0.0, min(1.0, float(score)))

    def _format_chunks(self, chunks: list[dict]) -> str:
        """Format chunks for the evaluation prompt.

        Args:
            chunks: List of chunk dictionaries with 'content' or 'text' keys

        Returns:
            Formatted string with numbered chunks and their sources
        """
        formatted = []
        for i, chunk in enumerate(chunks, 1):
            content = chunk.get("content", chunk.get("text", ""))
            source = chunk.get("source", chunk.get("metadata", {}).get("source", "Unknown"))
            formatted.append(f"[Chunk {i}] (Source: {source})\n{content}")
        return "\n\n".join(formatted)

    async def evaluate(
        self,
        query: str,
        answer: str,
        chunks: list[dict],
        expected_answer: str | None = None,
    ) -> EvaluationResult:
        """Run full evaluation on a Q&A pair.

        Args:
            query: The search query
            answer: The generated answer
            chunks: Retrieved chunks used for the answer
            expected_answer: Optional ground truth answer

        Returns:
            Complete EvaluationResult with all metrics
        """
        import time

        start_time = time.time()

        try:
            # Build context from chunks
            context = "\n\n".join(
                chunk.get("content", chunk.get("text", "")) for chunk in chunks
            )

            # Evaluate retrieval
            retrieval_result = await self.evaluate_retrieval(query, chunks)

            # Evaluate answer
            answer_result = await self.evaluate_answer(
                query, answer, context, expected_answer
            )

            latency_ms = int((time.time() - start_time) * 1000)

            return EvaluationResult(
                # Retrieval metrics
                context_relevance=retrieval_result.context_relevance,
                context_precision=retrieval_result.context_precision,
                context_coverage=retrieval_result.context_coverage,
                # Answer metrics
                faithfulness=answer_result.faithfulness,
                answer_relevance=answer_result.answer_relevance,
                completeness=answer_result.completeness,
                ground_truth_similarity=answer_result.ground_truth_similarity,
                # Reasoning
                retrieval_reasoning=retrieval_result.reasoning,
                answer_reasoning=answer_result.reasoning,
                # Metadata
                latency_ms=latency_ms,
            )

        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.error(f"Evaluation failed: {e}")

            # Return result with error
            return EvaluationResult(
                context_relevance=0.0,
                context_precision=0.0,
                context_coverage=0.0,
                faithfulness=0.0,
                answer_relevance=0.0,
                completeness=0.0,
                latency_ms=latency_ms,
                error_message=str(e),
            )
