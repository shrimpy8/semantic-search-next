"""Application configuration using Pydantic Settings."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8080
    debug: bool = False
    api_prefix: str = "/api/v1"

    # OpenAI
    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-large"
    llm_model: str = "gpt-4o-mini"

    # Cohere (optional)
    cohere_api_key: str = ""

    # ChromaDB
    chroma_host: str = "localhost"
    chroma_port: int = 8000

    # PostgreSQL
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "semantic_search"
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"

    # Retrieval Settings
    default_search_k: int = 5
    default_hybrid_alpha: float = 0.5
    default_retrieval_method: Literal["semantic", "bm25", "hybrid"] = "hybrid"
    use_reranking: bool = True
    reranker_provider: Literal["auto", "jina", "cohere"] = "auto"

    # Document Processing
    chunk_size: int = 1000
    chunk_overlap: int = 200

    @property
    def database_url(self) -> str:
        """Construct PostgreSQL connection URL."""
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def chroma_url(self) -> str:
        """Construct ChromaDB connection URL."""
        return f"http://{self.chroma_host}:{self.chroma_port}"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
