"""Anthropic LLM Judge implementation."""

import logging

from anthropic import AsyncAnthropic

from app.config import get_settings
from app.core.exceptions import JudgeResponseError, JudgeUnavailableError
from app.core.llm_judge.base import (
    AnswerEvalResult,
    BaseLLMJudge,
    RetrievalEvalResult,
    load_prompts,
)
from app.core.llm_judge.output_parser import parse_llm_json
from app.core.llm_judge.schemas import (
    AnswerEvalOutput,
    GroundTruthOutput,
    RetrievalEvalOutput,
)

logger = logging.getLogger(__name__)


# Default model for Anthropic judge
DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929"


class AnthropicJudge(BaseLLMJudge):
    """Anthropic-based LLM judge for evaluation."""

    def __init__(
        self,
        model: str | None = None,
        timeout: int | None = None,
        max_retries: int | None = None,
    ):
        """Initialize Anthropic judge.

        Args:
            model: Model to use (defaults to claude-sonnet-4-5-20250929)
            timeout: Request timeout (defaults to config value)
            max_retries: Max retries (defaults to config value)
        """
        settings = get_settings()

        super().__init__(
            model=model or DEFAULT_ANTHROPIC_MODEL,
            timeout=timeout or settings.eval_timeout_seconds,
            max_retries=max_retries or settings.eval_retry_count,
        )

        self._client: AsyncAnthropic | None = None
        self._prompts = load_prompts()

    @property
    def provider_name(self) -> str:
        """Return the provider name."""
        return "anthropic"

    def _get_client(self) -> AsyncAnthropic:
        """Get or create the Anthropic client."""
        if self._client is None:
            settings = get_settings()
            if not settings.anthropic_api_key:
                raise JudgeUnavailableError("anthropic", "ANTHROPIC_API_KEY not configured")
            self._client = AsyncAnthropic(
                api_key=settings.anthropic_api_key,
                timeout=float(self.timeout),
                max_retries=self.max_retries,
            )
        return self._client

    def is_available(self) -> bool:
        """Check if Anthropic judge is available."""
        settings = get_settings()
        return bool(settings.anthropic_api_key)

    async def _call_llm(self, system_prompt: str, user_prompt: str) -> str:
        """Make an LLM call and return raw text response.

        Args:
            system_prompt: System message
            user_prompt: User message

        Returns:
            Raw response text (JSON extraction done by caller)

        Raises:
            JudgeResponseError: If response is empty
        """
        client = self._get_client()

        logger.debug(f"Calling Anthropic judge with model: {self.model}")

        # Add JSON instruction to system prompt (externalized in evaluation.yaml)
        json_guardrail = self._prompts.get("json_guardrail", "")
        enhanced_system = f"{system_prompt}\n\n{json_guardrail}"

        response = await client.messages.create(
            model=self.model,
            max_tokens=1024,
            messages=[
                {"role": "user", "content": user_prompt},
            ],
            system=enhanced_system,
            temperature=0.0,  # Deterministic for evaluation
        )

        content = ""
        if response.content:
            first_block = response.content[0]
            content = getattr(first_block, "text", "")
        if not content:
            raise JudgeResponseError("Empty response from judge")

        logger.debug(f"Anthropic raw response length: {len(content)}")
        return content

    async def evaluate_retrieval(
        self,
        query: str,
        chunks: list[dict],
    ) -> RetrievalEvalResult:
        """Evaluate retrieval quality."""
        prompts = self._prompts["retrieval_evaluation"]

        system_prompt = prompts["system"]
        user_prompt = prompts["user"].format(
            query=query,
            chunks=self._format_chunks(chunks),
        )

        raw_text = await self._call_llm(system_prompt, user_prompt)

        # Parse and validate with shared parser + Pydantic schema (M3C)
        validated = parse_llm_json(raw_text, RetrievalEvalOutput)

        return RetrievalEvalResult(
            context_relevance=self._clamp_score(validated.context_relevance),
            context_precision=self._clamp_score(validated.context_precision),
            context_coverage=self._clamp_score(validated.context_coverage),
            reasoning=validated.reasoning,
        )

    async def evaluate_answer(
        self,
        query: str,
        answer: str,
        context: str,
        expected_answer: str | None = None,
    ) -> AnswerEvalResult:
        """Evaluate answer quality."""
        prompts = self._prompts["answer_evaluation"]

        system_prompt = prompts["system"]
        user_prompt = prompts["user"].format(
            query=query,
            context=context,
            answer=answer,
        )

        raw_text = await self._call_llm(system_prompt, user_prompt)

        # Parse and validate with shared parser + Pydantic schema (M3C)
        validated = parse_llm_json(raw_text, AnswerEvalOutput)

        # Get ground truth similarity if expected answer provided
        ground_truth_similarity = None
        gt_reasoning = ""
        if expected_answer:
            gt_raw = await self._call_llm(
                *self._build_ground_truth_prompts(query, answer, expected_answer)
            )
            gt_validated = parse_llm_json(gt_raw, GroundTruthOutput)
            ground_truth_similarity = gt_validated.ground_truth_similarity
            gt_reasoning = gt_validated.reasoning

        # Combine reasoning
        reasoning = validated.reasoning
        if gt_reasoning:
            reasoning += f"\n\nGround Truth Comparison: {gt_reasoning}"

        return AnswerEvalResult(
            faithfulness=self._clamp_score(validated.faithfulness),
            answer_relevance=self._clamp_score(validated.answer_relevance),
            completeness=self._clamp_score(validated.completeness),
            ground_truth_similarity=(
                self._clamp_score(ground_truth_similarity)
                if ground_truth_similarity is not None
                else None
            ),
            reasoning=reasoning,
        )

    def _build_ground_truth_prompts(
        self,
        query: str,
        generated_answer: str,
        expected_answer: str,
    ) -> tuple[str, str]:
        """Build system and user prompts for ground truth evaluation."""
        prompts = self._prompts["ground_truth_comparison"]

        system_prompt = prompts["system"]
        user_prompt = prompts["user"].format(
            query=query,
            expected_answer=expected_answer,
            generated_answer=generated_answer,
        )

        return system_prompt, user_prompt
