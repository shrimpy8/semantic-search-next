"""
Embedding Factory Module.

Provides a unified interface for multiple embedding providers:
- OpenAI (default): text-embedding-3-large, text-embedding-3-small
- Ollama (local): nomic-embed-text, mxbai-embed-large (runs on Mac M4)
- Jina AI: jina-embeddings-v2-base-en (free tier available)
- Cohere: embed-english-v3.0, embed-multilingual-v3.0
- Voyage AI: voyage-large-2 (best for RAG), voyage-code-2

Model string format: "provider:model_name" or just "model_name" for OpenAI
Examples:
  - "text-embedding-3-large" -> OpenAI
  - "ollama:nomic-embed-text" -> Ollama local
  - "jina:jina-embeddings-v2-base-en" -> Jina AI
  - "cohere:embed-english-v3.0" -> Cohere
  - "voyage:voyage-large-2" -> Voyage AI
"""

import logging
import os
from typing import Any, cast

from langchain_core.embeddings import Embeddings

logger = logging.getLogger(__name__)


# Provider configurations with model info
EMBEDDING_PROVIDERS: dict[str, dict[str, Any]] = {
    "openai": {
        "models": {
            "text-embedding-3-large": {"dims": 3072, "description": "Best quality"},
            "text-embedding-3-small": {"dims": 1536, "description": "Fast & cheap"},
            "text-embedding-ada-002": {"dims": 1536, "description": "Legacy"},
        },
        "env_key": "OPENAI_API_KEY",
    },
    "ollama": {
        "models": {
            "nomic-embed-text-v2-moe": {"dims": 768, "description": "Latest MoE, strong retrieval"},
            "nomic-embed-text": {"dims": 768, "description": "Local, fast, good quality"},
            "nomic-embed-text:v1.5": {"dims": 768, "description": "Latest version"},
            "mxbai-embed-large": {"dims": 1024, "description": "High quality local"},
            "mxbai-embed-large:335m": {"dims": 1024, "description": "335M params"},
            "embeddinggemma": {"dims": 768, "description": "Google Gemma embeddings"},
            "jina/jina-embeddings-v2-base-en": {"dims": 768, "description": "Jina via Ollama"},
            "all-minilm": {"dims": 384, "description": "Lightweight local"},
            "snowflake-arctic-embed": {"dims": 1024, "description": "Strong retrieval"},
        },
        "env_key": None,  # No API key needed
        "base_url": "OLLAMA_BASE_URL",
    },
    "jina": {
        "models": {
            "jina-embeddings-v2-base-en": {"dims": 768, "description": "English, open source"},
            "jina-embeddings-v2-small-en": {"dims": 512, "description": "Lightweight"},
            "jina-embeddings-v3": {"dims": 1024, "description": "Latest, multilingual"},
        },
        "env_key": "JINA_API_KEY",
    },
    "cohere": {
        "models": {
            "embed-english-v3.0": {"dims": 1024, "description": "English optimized"},
            "embed-multilingual-v3.0": {"dims": 1024, "description": "100+ languages"},
            "embed-english-light-v3.0": {"dims": 384, "description": "Fast English"},
        },
        "env_key": "COHERE_API_KEY",
    },
    "voyage": {
        "models": {
            "voyage-large-2": {"dims": 1536, "description": "Best for RAG"},
            "voyage-code-2": {"dims": 1536, "description": "Code optimized"},
            "voyage-2": {"dims": 1024, "description": "General purpose"},
            "voyage-lite-02-instruct": {"dims": 1024, "description": "Lightweight"},
        },
        "env_key": "VOYAGE_API_KEY",
    },
}


def parse_model_string(model_string: str) -> tuple[str, str]:
    """
    Parse model string into provider and model name.

    Args:
        model_string: Format "provider:model" or just "model" for OpenAI

    Returns:
        Tuple of (provider, model_name)

    Examples:
        >>> parse_model_string("text-embedding-3-large")
        ("openai", "text-embedding-3-large")
        >>> parse_model_string("ollama:nomic-embed-text")
        ("ollama", "nomic-embed-text")
    """
    if ":" in model_string:
        provider, model = model_string.split(":", 1)
        return provider.lower(), model
    else:
        # Default to OpenAI for backwards compatibility
        return "openai", model_string


def get_available_providers() -> dict:
    """
    Get available embedding providers with their models.

    Returns:
        Dict of provider info with availability status
    """
    available = {}

    for provider, config in EMBEDDING_PROVIDERS.items():
        env_key = config.get("env_key")

        if provider == "ollama":
            # Check if Ollama is running
            base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            try:
                import httpx
                response = httpx.get(f"{base_url}/api/tags", timeout=2.0)
                is_available = response.status_code == 200
            except Exception:
                is_available = False
        else:
            # Check if API key is set
            is_available = env_key is None or bool(os.getenv(env_key))

        available[provider] = {
            "available": is_available,
            "models": config["models"],
            "requires_api_key": env_key is not None,
        }

    return available


class EmbeddingFactory:
    """Factory for creating embedding instances from different providers."""

    @staticmethod
    def create(
        model_string: str,
        api_key: str | None = None,
        base_url: str | None = None,
    ) -> Embeddings:
        """
        Create an embedding instance based on model string.

        Args:
            model_string: Format "provider:model" or just "model" for OpenAI
            api_key: Optional API key (uses env var if not provided)
            base_url: Optional base URL for Ollama

        Returns:
            LangChain Embeddings instance

        Raises:
            ValueError: If provider is not supported
            ImportError: If required package is not installed
        """
        provider, model_name = parse_model_string(model_string)

        logger.info(f"Creating embeddings: provider={provider}, model={model_name}")

        if provider == "openai":
            return EmbeddingFactory._create_openai(model_name, api_key)
        elif provider == "ollama":
            return EmbeddingFactory._create_ollama(model_name, base_url)
        elif provider == "jina":
            return EmbeddingFactory._create_jina(model_name, api_key)
        elif provider == "cohere":
            return EmbeddingFactory._create_cohere(model_name, api_key)
        elif provider == "voyage":
            return EmbeddingFactory._create_voyage(model_name, api_key)
        else:
            raise ValueError(f"Unsupported embedding provider: {provider}")

    @staticmethod
    def _create_openai(model_name: str, api_key: str | None = None) -> Embeddings:
        """Create OpenAI embeddings."""
        from langchain_openai import OpenAIEmbeddings

        key = api_key or os.getenv("OPENAI_API_KEY")
        if not key:
            raise ValueError("OpenAI API key not provided. Set OPENAI_API_KEY env var.")

        logger.info(f"Initializing OpenAI embeddings: {model_name}")
        return OpenAIEmbeddings(model=model_name, api_key=cast(Any, key))

    @staticmethod
    def _create_ollama(model_name: str, base_url: str | None = None) -> Embeddings:
        """
        Create Ollama embeddings (local, no API key needed).

        Ollama runs locally and supports many embedding models.
        Great for Mac M4 with 24GB RAM.

        Install: brew install ollama
        Pull model: ollama pull nomic-embed-text
        """
        try:
            from langchain_ollama import OllamaEmbeddings  # type: ignore[import-not-found]  # noqa: I001
        except ImportError:
            raise ImportError(
                "langchain-ollama not installed. Run: pip install langchain-ollama"
            )

        url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

        logger.info(f"Initializing Ollama embeddings: {model_name} at {url}")
        return OllamaEmbeddings(
            model=model_name,
            base_url=url,
        )

    @staticmethod
    def _create_jina(model_name: str, api_key: str | None = None) -> Embeddings:
        """
        Create Jina AI embeddings.

        Jina offers a free tier with 1M tokens/month.
        Sign up at: https://jina.ai/embeddings/
        """
        try:
            from langchain_community.embeddings import JinaEmbeddings
        except ImportError:
            raise ImportError(
                "langchain-community not installed. Run: pip install langchain-community"
            )

        key = api_key or os.getenv("JINA_API_KEY")
        if not key:
            raise ValueError(
                "Jina API key not provided. Set JINA_API_KEY env var. "
                "Get a free key at: https://jina.ai/embeddings/"
            )

        logger.info(f"Initializing Jina embeddings: {model_name}")
        jina_embeddings = cast(Any, JinaEmbeddings)
        return jina_embeddings(
            model_name=model_name,
            jina_api_key=cast(Any, key),
        )

    @staticmethod
    def _create_cohere(model_name: str, api_key: str | None = None) -> Embeddings:
        """
        Create Cohere embeddings.

        Sign up at: https://cohere.com/
        """
        try:
            from langchain_cohere import CohereEmbeddings  # type: ignore[import-not-found]  # noqa: I001
        except ImportError:
            raise ImportError(
                "langchain-cohere not installed. Run: pip install langchain-cohere"
            )

        key = api_key or os.getenv("COHERE_API_KEY")
        if not key:
            raise ValueError(
                "Cohere API key not provided. Set COHERE_API_KEY env var. "
                "Sign up at: https://cohere.com/"
            )

        logger.info(f"Initializing Cohere embeddings: {model_name}")
        return CohereEmbeddings(
            model=model_name,
            cohere_api_key=cast(Any, key),
        )

    @staticmethod
    def _create_voyage(model_name: str, api_key: str | None = None) -> Embeddings:
        """
        Create Voyage AI embeddings.

        Voyage embeddings are optimized for RAG applications.
        Sign up at: https://www.voyageai.com/
        """
        try:
            from langchain_voyageai import VoyageAIEmbeddings  # type: ignore[import-not-found]  # noqa: I001
        except ImportError:
            raise ImportError(
                "langchain-voyageai not installed. Run: pip install langchain-voyageai"
            )

        key = api_key or os.getenv("VOYAGE_API_KEY")
        if not key:
            raise ValueError(
                "Voyage API key not provided. Set VOYAGE_API_KEY env var. "
                "Sign up at: https://www.voyageai.com/"
            )

        logger.info(f"Initializing Voyage AI embeddings: {model_name}")
        return VoyageAIEmbeddings(
            model=model_name,
            voyage_api_key=cast(Any, key),
        )

    @staticmethod
    def get_model_info(model_string: str) -> dict:
        """Get information about a model."""
        provider, model_name = parse_model_string(model_string)

        if provider not in EMBEDDING_PROVIDERS:
            return {"provider": provider, "model": model_name, "found": False}

        provider_config = EMBEDDING_PROVIDERS[provider]
        model_info = provider_config["models"].get(model_name, {})

        return {
            "provider": provider,
            "model": model_name,
            "found": bool(model_info),
            "dims": model_info.get("dims"),
            "description": model_info.get("description"),
            "requires_api_key": provider_config.get("env_key") is not None,
        }
