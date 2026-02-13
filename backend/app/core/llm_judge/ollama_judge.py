"""Ollama LLM Judge implementation for local evaluation."""

import logging

import httpx

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


# Default model for Ollama judge - good balance of speed and quality
DEFAULT_OLLAMA_MODEL = "mistral"


class OllamaJudge(BaseLLMJudge):
    """Ollama-based LLM judge for local evaluation.

    Uses Ollama's REST API for LLM inference. Requires Ollama server
    to be running locally (or at configured URL).

    Recommended models for evaluation:
        - mistral: Fast, good reasoning (default)
        - llama3: Better quality, slightly slower
        - neural-chat: Intel optimized, good for evaluation
    """

    def __init__(
        self,
        model: str | None = None,
        timeout: int | None = None,
        max_retries: int | None = None,
    ):
        """Initialize Ollama judge.

        Args:
            model: Model to use (defaults to mistral)
            timeout: Request timeout (defaults to config value)
            max_retries: Max retries (defaults to config value)
        """
        settings = get_settings()

        super().__init__(
            model=model or DEFAULT_OLLAMA_MODEL,
            timeout=timeout or settings.eval_timeout_seconds,
            max_retries=max_retries or settings.eval_retry_count,
        )

        self._base_url = settings.ollama_base_url.rstrip("/")
        self._prompts = load_prompts()

        logger.debug(
            f"OllamaJudge initialized: model={self.model}, "
            f"base_url={self._base_url}, timeout={self.timeout}s"
        )

    @property
    def provider_name(self) -> str:
        """Return the provider name."""
        return "ollama"

    def is_available(self) -> bool:
        """Check if Ollama server is reachable and model is available.

        Performs two checks:
        1. Server connectivity (GET /api/version)
        2. Model availability (GET /api/tags)

        Returns:
            True if server is running and model is available
        """
        try:
            with httpx.Client(timeout=5.0) as client:
                # Check server is running
                response = client.get(f"{self._base_url}/api/version")
                if response.status_code != 200:
                    logger.warning(
                        f"Ollama server returned status {response.status_code}"
                    )
                    return False

                # Check model is available
                tags_response = client.get(f"{self._base_url}/api/tags")
                if tags_response.status_code != 200:
                    logger.warning("Failed to fetch Ollama model list")
                    return False

                models_data = tags_response.json()
                available_models = [
                    m.get("name", "").split(":")[0]
                    for m in models_data.get("models", [])
                ]

                # Check if our model (or base name) is available
                model_base = self.model.split(":")[0]
                if model_base not in available_models and self.model not in [
                    m.get("name") for m in models_data.get("models", [])
                ]:
                    logger.warning(
                        f"Model '{self.model}' not found in Ollama. "
                        f"Available: {available_models}. "
                        f"Run: ollama pull {self.model}"
                    )
                    return False

                logger.debug(f"Ollama available with model: {self.model}")
                return True

        except httpx.ConnectError:
            logger.warning(
                f"Cannot connect to Ollama at {self._base_url}. "
                "Is Ollama running? Start with: ollama serve"
            )
            return False
        except httpx.TimeoutException:
            logger.warning(f"Timeout connecting to Ollama at {self._base_url}")
            return False
        except Exception as e:
            logger.warning(f"Ollama availability check failed: {e}")
            return False

    async def _call_llm(self, system_prompt: str, user_prompt: str) -> str:
        """Make an Ollama API call and return raw text response.

        Uses the /api/chat endpoint with the chat completions format.

        Args:
            system_prompt: System message
            user_prompt: User message

        Returns:
            Raw response text (JSON extraction done by caller)

        Raises:
            JudgeUnavailableError: If Ollama server is not reachable
            JudgeResponseError: If response is empty
        """
        # Add JSON instruction to system prompt (externalized in evaluation.yaml)
        json_guardrail = self._prompts.get("json_guardrail", "")
        enhanced_system = f"{system_prompt}\n\n{json_guardrail}"

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": enhanced_system},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "options": {
                "temperature": 0.0,  # Deterministic for evaluation
            },
        }

        logger.debug(f"Calling Ollama judge: model={self.model}")

        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(float(self.timeout))
            ) as client:
                response = await client.post(
                    f"{self._base_url}/api/chat",
                    json=payload,
                )

                if response.status_code != 200:
                    error_text = response.text
                    logger.error(
                        f"Ollama API error: status={response.status_code}, "
                        f"response={error_text}"
                    )
                    raise JudgeUnavailableError(
                        "ollama",
                        f"API returned status {response.status_code}: {error_text}",
                    )

                result = response.json()
                content = result.get("message", {}).get("content", "")

                if not content:
                    raise JudgeResponseError("Empty response from Ollama judge")

                logger.debug(f"Ollama raw response length: {len(content)}")
                return content

        except httpx.ConnectError as e:
            logger.error(f"Cannot connect to Ollama: {e}")
            raise JudgeUnavailableError(
                "ollama",
                f"Cannot connect to Ollama at {self._base_url}. "
                "Ensure Ollama is running: ollama serve",
            )
        except httpx.TimeoutException:
            logger.error(f"Ollama request timed out after {self.timeout}s")
            raise JudgeUnavailableError(
                "ollama",
                f"Request timed out after {self.timeout}s. "
                "The model may be loading or the server is overloaded.",
            )

    async def evaluate_retrieval(
        self,
        query: str,
        chunks: list[dict],
    ) -> RetrievalEvalResult:
        """Evaluate retrieval quality.

        Args:
            query: The search query
            chunks: List of retrieved chunks with content and metadata

        Returns:
            RetrievalEvalResult with scores and reasoning
        """
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
        """Evaluate answer quality.

        Args:
            query: The original question
            answer: The generated answer
            context: The context used to generate the answer
            expected_answer: Optional ground truth answer for comparison

        Returns:
            AnswerEvalResult with scores and reasoning
        """
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
