"""
Application Configuration Module.

This module handles INFRASTRUCTURE configuration loaded from environment variables.
User-configurable settings (models, presets, etc.) are stored in DB Settings.

Configuration Hierarchy:
------------------------
1. .env / Environment Variables (this file):
   - API keys and secrets (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
   - Infrastructure URLs (POSTGRES_*, CHROMA_*, OLLAMA_BASE_URL)
   - Server configuration (API_HOST, API_PORT, DEBUG)
   - Operational timeouts (EVAL_TIMEOUT_SECONDS, etc.)

2. DB Settings (app/db/models.py Settings):
   - User preferences (default_alpha, default_preset, etc.)
   - Model selections (embedding_model, answer_provider, answer_model, etc.)
   - Document processing (chunk_size, chunk_overlap)
   - Display options (show_scores, results_per_page)

IMPORTANT: Do NOT add user-configurable settings here. They belong in DB Settings.
"""

import logging
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """
    Infrastructure settings loaded from environment variables.

    These are deployment-specific settings that require server restart to change.
    For user-configurable settings, see DB Settings (app/db/models.py).
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ==========================================================================
    # API Server Configuration
    # ==========================================================================
    api_host: str = "0.0.0.0"
    api_port: int = 8080
    debug: bool = False
    api_prefix: str = "/api/v1"

    # Feature Flags (Safety Controls)
    # Set to False to disable injection detection (rollback)
    enable_injection_detection: bool = True

    # ==========================================================================
    # API Keys (Secrets - NEVER expose in UI)
    # ==========================================================================
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    cohere_api_key: str = ""
    jina_api_key: str = ""
    voyage_api_key: str = ""

    # ==========================================================================
    # Infrastructure URLs
    # ==========================================================================
    # ChromaDB Vector Store
    chroma_host: str = "localhost"
    chroma_port: int = 8000

    # PostgreSQL Database
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "semantic_search"
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"

    # Ollama Local LLM Server
    ollama_base_url: str = "http://localhost:11434"

    # ==========================================================================
    # Operational Settings (Advanced - rarely changed)
    # ==========================================================================
    # Evaluation timeouts and retries
    eval_timeout_seconds: int = 30
    eval_retry_count: int = 2
    eval_retry_delay_ms: int = 1000

    # ==========================================================================
    # Computed Properties
    # ==========================================================================
    @property
    def database_url(self) -> str:
        """Construct PostgreSQL async connection URL."""
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_url_sync(self) -> str:
        """Construct PostgreSQL sync connection URL (for Alembic)."""
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def chroma_url(self) -> str:
        """Construct ChromaDB connection URL."""
        return f"http://{self.chroma_host}:{self.chroma_port}"

    # ==========================================================================
    # Provider Availability Checks
    # ==========================================================================
    def is_openai_available(self) -> bool:
        """Check if OpenAI API key is configured."""
        return bool(self.openai_api_key)

    def is_anthropic_available(self) -> bool:
        """Check if Anthropic API key is configured."""
        return bool(self.anthropic_api_key)

    def is_cohere_available(self) -> bool:
        """Check if Cohere API key is configured."""
        return bool(self.cohere_api_key)

    def is_jina_available(self) -> bool:
        """Check if Jina API key is configured."""
        return bool(self.jina_api_key)

    def is_voyage_available(self) -> bool:
        """Check if Voyage API key is configured."""
        return bool(self.voyage_api_key)

    def check_ollama_available(self) -> bool:
        """
        Check if Ollama server is reachable.

        Note: This makes a network call, use sparingly.
        """
        try:
            import httpx
            response = httpx.get(
                f"{self.ollama_base_url}/api/tags",
                timeout=2.0
            )
            return response.status_code == 200
        except Exception:
            return False

    def get_available_llm_providers(self) -> list[str]:
        """Get list of available LLM providers for answers/evaluation."""
        available = []
        if self.is_openai_available():
            available.append("openai")
        if self.is_anthropic_available():
            available.append("anthropic")
        # Ollama is always potentially available (local)
        available.append("ollama")
        return available

    def get_available_embedding_providers(self) -> list[str]:
        """Get list of available embedding providers."""
        available = []
        if self.is_openai_available():
            available.append("openai")
        if self.is_jina_available():
            available.append("jina")
        if self.is_cohere_available():
            available.append("cohere")
        if self.is_voyage_available():
            available.append("voyage")
        # Ollama is always potentially available (local)
        available.append("ollama")
        return available

    def get_available_reranker_providers(self) -> list[str]:
        """Get list of available reranker providers."""
        available = ["jina"]  # Jina reranker is local, always available
        if self.is_cohere_available():
            available.append("cohere")
        return available


@lru_cache
def get_settings() -> Settings:
    """
    Get cached settings instance.

    Returns the singleton Settings instance. The instance is cached
    for the lifetime of the application.
    """
    settings = Settings()
    logger.info(
        f"Settings loaded: debug={settings.debug}, "
        f"chroma={settings.chroma_host}:{settings.chroma_port}, "
        f"ollama={settings.ollama_base_url}"
    )
    return settings


def clear_settings_cache() -> None:
    """
    Clear the settings cache.

    Useful for testing or when environment variables change.
    """
    get_settings.cache_clear()
    logger.info("Settings cache cleared")
