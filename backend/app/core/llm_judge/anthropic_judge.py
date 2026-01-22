"""Anthropic LLM Judge implementation."""

import json
import logging
import re

from anthropic import AsyncAnthropic

from app.config import get_settings
from app.core.exceptions import JudgeResponseError, JudgeUnavailableError
from app.core.llm_judge.base import (
    AnswerEvalResult,
    BaseLLMJudge,
    RetrievalEvalResult,
    load_prompts,
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

    def _extract_json(self, text: str) -> dict:
        """Extract JSON from response text.

        Claude may include markdown code blocks or explanatory text,
        so we need to extract just the JSON object.

        Args:
            text: Raw response text

        Returns:
            Parsed JSON as dict

        Raises:
            JudgeResponseError: If no valid JSON found
        """
        # Try to parse the whole response as JSON first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Look for JSON in code blocks
        json_patterns = [
            r"```json\s*\n(.*?)\n```",  # ```json ... ```
            r"```\s*\n(.*?)\n```",  # ``` ... ```
            r"\{[^{}]*\}",  # Simple object match
        ]

        for pattern in json_patterns:
            matches = re.findall(pattern, text, re.DOTALL)
            for match in matches:
                try:
                    return json.loads(match)
                except json.JSONDecodeError:
                    continue

        # Try to find any JSON-like structure
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass

        raise JudgeResponseError("Could not extract valid JSON from response", text)

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

        logger.debug(f"Calling Anthropic judge with model: {self.model}")

        # Add JSON instruction to system prompt
        enhanced_system = (
            f"{system_prompt}\n\n"
            "IMPORTANT: Respond with ONLY a valid JSON object. "
            "Do not include any explanatory text before or after the JSON."
        )

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

        try:
            result = self._extract_json(content)
            logger.debug(f"Judge response: {result}")
            return result
        except JudgeResponseError:
            logger.error(f"Failed to parse judge response: {content}")
            raise

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

        return RetrievalEvalResult(
            context_relevance=self._clamp_score(result.get("context_relevance", 0.0)),
            context_precision=self._clamp_score(result.get("context_precision", 0.0)),
            context_coverage=self._clamp_score(result.get("context_coverage", 0.0)),
            reasoning=result.get("reasoning", ""),
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

        # Get ground truth similarity if expected answer provided
        ground_truth_similarity = None
        gt_reasoning = ""
        if expected_answer:
            gt_result = await self._evaluate_ground_truth(query, answer, expected_answer)
            ground_truth_similarity = gt_result.get("ground_truth_similarity")
            gt_reasoning = gt_result.get("reasoning", "")

        # Combine reasoning
        reasoning = result.get("reasoning", "")
        if gt_reasoning:
            reasoning += f"\n\nGround Truth Comparison: {gt_reasoning}"

        return AnswerEvalResult(
            faithfulness=self._clamp_score(result.get("faithfulness", 0.0)),
            answer_relevance=self._clamp_score(result.get("answer_relevance", 0.0)),
            completeness=self._clamp_score(result.get("completeness", 0.0)),
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
