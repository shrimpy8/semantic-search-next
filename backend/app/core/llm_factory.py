"""LLM Factory for creating language model instances.

Provides a unified interface for creating LLM instances across different
providers (OpenAI, Anthropic, Ollama) for answer generation.
"""

import logging
from typing import Any, ClassVar, cast

from langchain_core.language_models.chat_models import BaseChatModel

from app.config import get_settings

logger = logging.getLogger(__name__)


class LLMUnavailableError(Exception):
    """Raised when an LLM provider is not available."""

    def __init__(self, provider: str, reason: str | None = None):
        self.provider = provider
        self.reason = reason
        message = f"LLM provider '{provider}' is not available"
        if reason:
            message += f": {reason}"
        super().__init__(message)


class LLMFactory:
    """Factory for creating LLM instances for answer generation.

    Supports multiple providers with a unified interface:
    - openai: ChatOpenAI (GPT-4, GPT-4o-mini, etc.)
    - anthropic: ChatAnthropic (Claude models)
    - ollama: ChatOllama (local models like Mistral, Llama3)

    Example:
        >>> llm = LLMFactory.create("openai", "gpt-4o-mini", temperature=0.0)
        >>> response = llm.invoke("Hello!")
    """

    # Provider configurations
    PROVIDERS: ClassVar[dict] = {
        "openai": {
            "models": [
                "gpt-4o-mini",
                "gpt-4o",
                "gpt-4-turbo",
                "gpt-3.5-turbo",
            ],
            "default_model": "gpt-4o-mini",
            "requires_api_key": True,
        },
        "anthropic": {
            "models": [
                "claude-sonnet-4-5-20250929",
                "claude-3-5-haiku-latest",
                "claude-3-opus-latest",
            ],
            "default_model": "claude-sonnet-4-5-20250929",
            "requires_api_key": True,
        },
        "ollama": {
            "models": [
                "llama3.2:3b",
                "ministral-3:8b",
                "deepseek-r1:8b",
                "gemma3:4b",
                "mistral",
                "llama3",
                "dolphin-mixtral",
                "neural-chat",
                "phi",
            ],
            "default_model": "llama3.2:3b",
            "requires_api_key": False,
        },
    }

    @classmethod
    def create(
        cls,
        provider: str,
        model: str | None = None,
        temperature: float = 0.0,
        **kwargs,
    ) -> BaseChatModel:
        """Create an LLM instance for the specified provider.

        Args:
            provider: Provider name (openai, anthropic, ollama)
            model: Model name (defaults to provider's default model)
            temperature: Temperature for generation (0.0 = deterministic)
            **kwargs: Additional arguments passed to the LLM constructor

        Returns:
            Configured BaseChatModel instance

        Raises:
            LLMUnavailableError: If provider is unknown or not configured
        """
        provider = provider.lower()

        if provider not in cls.PROVIDERS:
            available = list(cls.PROVIDERS.keys())
            raise LLMUnavailableError(
                provider,
                f"Unknown provider. Available: {available}",
            )

        provider_config = cls.PROVIDERS[provider]
        model = model or provider_config["default_model"]

        logger.debug(f"Creating LLM: provider={provider}, model={model}")

        if provider == "openai":
            return cls._create_openai(model, temperature, **kwargs)
        elif provider == "anthropic":
            return cls._create_anthropic(model, temperature, **kwargs)
        elif provider == "ollama":
            return cls._create_ollama(model, temperature, **kwargs)
        else:
            raise LLMUnavailableError(provider, "Provider not implemented")

    @classmethod
    def _create_openai(
        cls,
        model: str,
        temperature: float,
        **kwargs,
    ) -> BaseChatModel:
        """Create an OpenAI LLM instance."""
        from langchain_openai import ChatOpenAI

        settings = get_settings()

        if not settings.openai_api_key:
            raise LLMUnavailableError(
                "openai",
                "OPENAI_API_KEY not configured",
            )

        llm = ChatOpenAI(
            model=model,
            temperature=temperature,
            api_key=cast(Any, settings.openai_api_key),
            **kwargs,
        )

        logger.info(f"Created OpenAI LLM: model={model}, temp={temperature}")
        return llm

    @classmethod
    def _create_anthropic(
        cls,
        model: str,
        temperature: float,
        **kwargs,
    ) -> BaseChatModel:
        """Create an Anthropic LLM instance."""
        from langchain_anthropic import ChatAnthropic

        settings = get_settings()

        if not settings.anthropic_api_key:
            raise LLMUnavailableError(
                "anthropic",
                "ANTHROPIC_API_KEY not configured",
            )

        chat_anthropic = cast(Any, ChatAnthropic)
        llm = chat_anthropic(
            model=model,
            temperature=temperature,
            api_key=cast(Any, settings.anthropic_api_key),
            **kwargs,
        )

        logger.info(f"Created Anthropic LLM: model={model}, temp={temperature}")
        return llm

    @classmethod
    def _create_ollama(
        cls,
        model: str,
        temperature: float,
        **kwargs,
    ) -> BaseChatModel:
        """Create an Ollama LLM instance."""
        from langchain_ollama import ChatOllama

        settings = get_settings()

        llm = ChatOllama(
            model=model,
            temperature=temperature,
            base_url=settings.ollama_base_url,
            **kwargs,
        )

        logger.info(
            f"Created Ollama LLM: model={model}, temp={temperature}, "
            f"base_url={settings.ollama_base_url}"
        )
        return llm

    @classmethod
    def get_available_providers(cls) -> list[str]:
        """Get list of providers that are currently available.

        Checks API key configuration and service availability.

        Returns:
            List of provider names that are ready to use
        """
        settings = get_settings()
        available = []

        # Check OpenAI
        if settings.openai_api_key:
            available.append("openai")

        # Check Anthropic
        if settings.anthropic_api_key:
            available.append("anthropic")

        # Check Ollama (always attempt - it's local)
        # We could do a health check here but that adds latency
        # For now, we assume Ollama is available if the URL is configured
        if settings.ollama_base_url:
            available.append("ollama")

        return available

    @classmethod
    def get_models_for_provider(cls, provider: str) -> list[str]:
        """Get available models for a provider.

        Args:
            provider: Provider name

        Returns:
            List of model names for the provider

        Raises:
            LLMUnavailableError: If provider is unknown
        """
        provider = provider.lower()

        if provider not in cls.PROVIDERS:
            raise LLMUnavailableError(provider, "Unknown provider")

        return cls.PROVIDERS[provider]["models"]

    @classmethod
    def get_default_model(cls, provider: str) -> str:
        """Get the default model for a provider.

        Args:
            provider: Provider name

        Returns:
            Default model name for the provider

        Raises:
            LLMUnavailableError: If provider is unknown
        """
        provider = provider.lower()

        if provider not in cls.PROVIDERS:
            raise LLMUnavailableError(provider, "Unknown provider")

        return cls.PROVIDERS[provider]["default_model"]

    @classmethod
    def is_provider_available(cls, provider: str) -> bool:
        """Check if a specific provider is available.

        Args:
            provider: Provider name

        Returns:
            True if provider is configured and available
        """
        return provider.lower() in cls.get_available_providers()
