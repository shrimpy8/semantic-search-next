"""Factory for creating LLM judge instances."""

import logging
from typing import ClassVar

from app.core.exceptions import JudgeUnavailableError
from app.core.llm_judge.base import BaseLLMJudge

logger = logging.getLogger(__name__)

# Default provider when none specified (should be passed from DB Settings in production)
DEFAULT_JUDGE_PROVIDER = "openai"


class JudgeFactory:
    """Factory for creating LLM judge instances.

    Supports pluggable architecture for different LLM providers.

    Note: Provider should be passed explicitly from DB Settings (eval_judge_provider).
    The factory does NOT read from config.py since provider selection is user-configurable.
    """

    _registry: ClassVar[dict[str, type[BaseLLMJudge]]] = {}

    @classmethod
    def register(cls, provider: str, judge_class: type[BaseLLMJudge]) -> None:
        """Register a judge implementation.

        Args:
            provider: Provider name (e.g., 'openai', 'anthropic')
            judge_class: Judge class to register
        """
        cls._registry[provider.lower()] = judge_class
        logger.info(f"Registered judge provider: {provider}")

    @classmethod
    def create(
        cls,
        provider: str | None = None,
        model: str | None = None,
        **kwargs,
    ) -> BaseLLMJudge:
        """Create a judge instance.

        Args:
            provider: Provider name. Should be passed from DB Settings (eval_judge_provider).
                     Defaults to 'openai' if not specified.
            model: Model to use (defaults to provider default)
            **kwargs: Additional arguments passed to judge constructor

        Returns:
            Configured judge instance

        Raises:
            JudgeUnavailableError: If provider is unknown or unavailable
        """
        # Use provided provider or fall back to default
        # Note: Caller should pass provider from DB settings (eval_judge_provider)
        provider = (provider or DEFAULT_JUDGE_PROVIDER).lower()

        if provider not in cls._registry:
            available = list(cls._registry.keys())
            raise JudgeUnavailableError(
                provider,
                f"Unknown provider. Available: {available}",
            )

        judge_class = cls._registry[provider]
        judge = judge_class(model=model, **kwargs)

        if not judge.is_available():
            raise JudgeUnavailableError(
                provider,
                "Provider is registered but not available (check API key)",
            )

        logger.info(f"Created {provider} judge with model: {judge.model_name}")
        return judge

    @classmethod
    def get_available_providers(cls) -> list[str]:
        """Get list of available (configured) providers.

        Returns:
            List of provider names that are ready to use
        """
        available = []
        for provider, judge_class in cls._registry.items():
            try:
                judge = judge_class()
                if judge.is_available():
                    available.append(provider)
            except Exception:
                continue
        return available

    @classmethod
    def get_registered_providers(cls) -> list[str]:
        """Get list of all registered providers.

        Returns:
            List of all registered provider names
        """
        return list(cls._registry.keys())


def _register_default_judges() -> None:
    """Register default judge implementations."""
    from app.core.llm_judge.anthropic_judge import AnthropicJudge
    from app.core.llm_judge.ollama_judge import OllamaJudge
    from app.core.llm_judge.openai_judge import OpenAIJudge

    JudgeFactory.register("openai", OpenAIJudge)
    JudgeFactory.register("anthropic", AnthropicJudge)
    JudgeFactory.register("ollama", OllamaJudge)


# Register default judges on module import
_register_default_judges()
