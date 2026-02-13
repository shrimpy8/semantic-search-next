"""OpenAI LLM Judge implementation."""

import json
import logging

from openai import AsyncOpenAI

from app.config import get_settings
from app.core.exceptions import JudgeResponseError, JudgeUnavailableError
from app.core.llm_judge.base import (
    AnswerEvalResult,
    BaseLLMJudge,
    RetrievalEvalResult,
    load_prompts,
)
from app.core.llm_judge.schemas import (
    AnswerEvalOutput,
    GroundTruthOutput,
    RetrievalEvalOutput,
)

logger = logging.getLogger(__name__)


class OpenAIJudge(BaseLLMJudge):
    """OpenAI-based LLM judge for evaluation."""

    def __init__(
        self,
        model: str | None = None,
        timeout: int | None = None,
        max_retries: int | None = None,
    ):
        """Initialize OpenAI judge.

        Args:
            model: Model to use (defaults to config value)
            timeout: Request timeout (defaults to config value)
            max_retries: Max retries (defaults to config value)
        """
        settings = get_settings()

        super().__init__(
            model=model or "gpt-4o-mini",
            timeout=timeout or settings.eval_timeout_seconds,
            max_retries=max_retries or settings.eval_retry_count,
        )

        self._client: AsyncOpenAI | None = None
        self._prompts = load_prompts()

    @property
    def provider_name(self) -> str:
        """Return the provider name."""
        return "openai"

    def _get_client(self) -> AsyncOpenAI:
        """Get or create the OpenAI client."""
        if self._client is None:
            settings = get_settings()
            if not settings.openai_api_key:
                raise JudgeUnavailableError("openai", "OPENAI_API_KEY not configured")
            self._client = AsyncOpenAI(
                api_key=settings.openai_api_key,
                timeout=self.timeout,
                max_retries=self.max_retries,
            )
        return self._client

    def is_available(self) -> bool:
        """Check if OpenAI judge is available."""
        settings = get_settings()
        return bool(settings.openai_api_key)

    async def _call_llm(self, system_prompt: str, user_prompt: str) -> dict:
        """Make an LLM call and parse JSON response.

        Args:
            system_prompt: System message
            user_prompt: User message

        Returns:
            Parsed JSON response as dict

        Raises:
            JudgeResponseError: If response is not valid JSON
        """
        client = self._get_client()

        logger.debug(f"Calling OpenAI judge with model: {self.model}")

        response = await client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.0,  # Deterministic for evaluation
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        if not content:
            raise JudgeResponseError("Empty response from judge")

        try:
            result = json.loads(content)
            logger.debug(f"Judge response: {result}")
            return result
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse judge response: {content}")
            raise JudgeResponseError(f"Invalid JSON response: {e}", content)

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

        result = await self._call_llm(system_prompt, user_prompt)

        # Validate against Pydantic schema (M3C)
        validated = RetrievalEvalOutput.model_validate(result)

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

        result = await self._call_llm(system_prompt, user_prompt)

        # Validate against Pydantic schema (M3C)
        validated = AnswerEvalOutput.model_validate(result)

        # Get ground truth similarity if expected answer provided
        ground_truth_similarity = None
        gt_reasoning = ""
        if expected_answer:
            gt_result = await self._evaluate_ground_truth(query, answer, expected_answer)
            gt_validated = GroundTruthOutput.model_validate(gt_result)
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

    async def _evaluate_ground_truth(
        self,
        query: str,
        generated_answer: str,
        expected_answer: str,
    ) -> dict:
        """Evaluate similarity to ground truth answer."""
        prompts = self._prompts["ground_truth_comparison"]

        system_prompt = prompts["system"]
        user_prompt = prompts["user"].format(
            query=query,
            expected_answer=expected_answer,
            generated_answer=generated_answer,
        )

        return await self._call_llm(system_prompt, user_prompt)
