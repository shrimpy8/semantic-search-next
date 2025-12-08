"""
Settings API endpoints.

Provides endpoints for managing application-wide settings.
Uses singleton pattern - there's only one settings record.
"""

import logging
from typing import Any

from fastapi import APIRouter, status

from app.api.deps import SettingsRepo
from app.api.schemas import SettingsResponse, SettingsUpdate
from app.core.embeddings import get_available_providers

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get(
    "",
    response_model=SettingsResponse,
    summary="Get settings",
    description="Retrieve current application settings.",
)
async def get_settings(repo: SettingsRepo) -> SettingsResponse:
    """Get current application settings."""
    settings = await repo.get()
    return SettingsResponse.from_model(settings)


@router.patch(
    "",
    response_model=SettingsResponse,
    summary="Update settings",
    description="Update application settings. Only provided fields are updated.",
)
async def update_settings(
    data: SettingsUpdate,
    repo: SettingsRepo,
) -> SettingsResponse:
    """Update settings with provided values."""
    # Only pass non-None values to the repository
    update_data = data.model_dump(exclude_none=True)

    if update_data:
        settings = await repo.update_settings(**update_data)
        logger.info(f"Updated settings: {list(update_data.keys())}")
    else:
        settings = await repo.get()

    return SettingsResponse.from_model(settings)


@router.post(
    "/reset",
    response_model=SettingsResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset settings",
    description="Reset all settings to their default values.",
)
async def reset_settings(repo: SettingsRepo) -> SettingsResponse:
    """Reset all settings to defaults."""
    settings = await repo.reset_to_defaults()
    logger.info("Reset settings to defaults")
    return SettingsResponse.from_model(settings)


@router.get(
    "/embedding-providers",
    response_model=dict[str, Any],
    summary="Get embedding providers",
    description="Get available embedding providers with their models and availability status.",
)
async def get_embedding_providers() -> dict[str, Any]:
    """
    Get available embedding providers with their models.

    Returns information about each provider including:
    - available: Whether the provider can be used (API key set or local server running)
    - models: Available models with their dimensions and descriptions
    - requires_api_key: Whether an API key is needed

    Priority providers for local usage (Mac M4 24GB):
    1. Ollama (local, no API key) - nomic-embed-text, mxbai-embed-large
    2. OpenAI (API key required) - text-embedding-3-large
    3. Jina (free tier) - jina-embeddings-v2-base-en
    4. Cohere (API key) - embed-english-v3.0
    5. Voyage (API key) - voyage-large-2
    """
    providers = get_available_providers()
    return {
        "providers": providers,
        "recommended_local": "ollama:nomic-embed-text",
        "recommended_cloud": "text-embedding-3-large",
    }
