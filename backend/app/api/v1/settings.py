"""
Settings API endpoints.

Provides endpoints for managing application-wide settings.
Uses singleton pattern - there's only one settings record.
"""

import logging
from collections.abc import Callable
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.api.deps import SettingsRepo
from app.api.schemas import (
    SettingsResponse,
    SettingsUpdate,
    SetupValidationItem,
    SetupValidationResponse,
)
from app.config import Settings
from app.config import get_settings as get_app_config
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

    # Guard embedding model changes - requires explicit confirmation
    if "embedding_model" in update_data:
        current = await repo.get()
        if update_data["embedding_model"] != current.embedding_model and not data.confirm_reindex:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Changing embedding_model requires confirm_reindex=true and a full re-index of documents.",
            )

    # confirm_reindex is not stored; remove before update
    update_data.pop("confirm_reindex", None)

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


@router.get(
    "/llm-models",
    response_model=dict[str, Any],
    summary="Get LLM models",
    description="Get available LLM models for answer generation and evaluation.",
)
async def get_llm_models() -> dict[str, Any]:
    """
    Get available LLM models grouped by provider.

    Returns models for:
    - Answer generation (RAG responses)
    - Evaluation (LLM-as-judge)

    Each provider includes availability status based on API key configuration.
    """
    settings = get_app_config()

    return {
        "answer_providers": {
            "openai": {
                "available": settings.is_openai_available(),
                "models": [
                    {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "description": "Fast, cheap, good for RAG"},
                    {"id": "gpt-4o", "name": "GPT-4o", "description": "Best quality, more expensive"},
                    {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "description": "Good balance"},
                    {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "description": "Fastest, cheapest"},
                ],
                "default": "gpt-4o-mini",
            },
            "anthropic": {
                "available": settings.is_anthropic_available(),
                "models": [
                    {"id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4", "description": "Fast, good quality"},
                    {"id": "claude-opus-4-20250514", "name": "Claude Opus 4", "description": "Best quality, slower"},
                ],
                "default": "claude-sonnet-4-20250514",
            },
            "ollama": {
                "available": True,  # Always potentially available (local)
                "models": [
                    {"id": "llama3.2", "name": "Llama 3.2", "description": "Latest Llama model"},
                    {"id": "llama3.1", "name": "Llama 3.1", "description": "Strong open model"},
                    {"id": "mistral", "name": "Mistral", "description": "Fast, efficient"},
                    {"id": "mixtral", "name": "Mixtral", "description": "MoE model, high quality"},
                    {"id": "qwen2.5", "name": "Qwen 2.5", "description": "Strong multilingual"},
                ],
                "default": "llama3.2",
                "note": "Run 'ollama list' to see installed models",
            },
        },
        "eval_providers": {
            "openai": {
                "available": settings.is_openai_available(),
                "models": [
                    {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "description": "Fast evaluation"},
                    {"id": "gpt-4o", "name": "GPT-4o", "description": "Best evaluation quality"},
                ],
                "default": "gpt-4o-mini",
            },
            "anthropic": {
                "available": settings.is_anthropic_available(),
                "models": [
                    {"id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4", "description": "Fast, good quality"},
                    {"id": "claude-opus-4-20250514", "name": "Claude Opus 4", "description": "Best quality"},
                ],
                "default": "claude-sonnet-4-20250514",
            },
            "ollama": {
                "available": True,
                "models": [
                    {"id": "llama3.2", "name": "Llama 3.2", "description": "Local evaluation"},
                    {"id": "llama3.1", "name": "Llama 3.1", "description": "Strong reasoning"},
                ],
                "default": "llama3.2",
                "note": "Run 'ollama list' to see installed models",
            },
            "disabled": {
                "available": True,
                "models": [],
                "description": "Disable evaluation feature",
            },
        },
        "recommended": {
            "answer_provider": "openai",
            "answer_model": "gpt-4o-mini",
            "eval_provider": "openai",
            "eval_model": "gpt-4o-mini",
        },
    }


@router.get(
    "/providers",
    response_model=dict[str, Any],
    summary="Get all provider availability",
    description="Get availability status for all provider types (LLM, embedding, reranker).",
)
async def get_provider_availability() -> dict[str, Any]:
    """
    Get comprehensive provider availability information.

    Returns:
        - llm_providers: Available LLM providers for answers and evaluation
        - embedding_providers: Available embedding providers
        - reranker_providers: Available reranker providers
        - ollama_status: Whether Ollama server is reachable

    Provider availability is determined by API key configuration in .env file.
    Ollama is always listed but check ollama_status for actual reachability.
    """
    settings = get_app_config()

    return {
        "llm_providers": settings.get_available_llm_providers(),
        "embedding_providers": settings.get_available_embedding_providers(),
        "reranker_providers": settings.get_available_reranker_providers(),
        "provider_details": {
            "openai": {
                "available": settings.is_openai_available(),
                "features": ["embeddings", "llm", "evaluation"],
            },
            "anthropic": {
                "available": settings.is_anthropic_available(),
                "features": ["llm", "evaluation"],
            },
            "cohere": {
                "available": settings.is_cohere_available(),
                "features": ["embeddings", "reranking"],
            },
            "jina": {
                "available": settings.is_jina_available(),
                "features": ["embeddings", "reranking"],
                "note": "Jina reranker is local and always available",
            },
            "voyage": {
                "available": settings.is_voyage_available(),
                "features": ["embeddings"],
            },
            "ollama": {
                "available": True,  # Always potentially available (local)
                "features": ["embeddings", "llm", "evaluation"],
                "note": "Local server - run 'ollama list' to check models",
                "base_url": settings.ollama_base_url,
            },
        },
    }


def _get_embedding_provider(model: str) -> str:
    """Extract provider from embedding model string (e.g., 'ollama:nomic-embed-text' -> 'ollama')."""
    if ":" in model:
        return model.split(":")[0].lower()
    # Default to OpenAI for models without prefix
    return "openai"


def _check_provider_api_key(provider: str, settings: Settings) -> bool:
    """Check if the required API key is configured for a provider."""
    provider_checks: dict[str, Callable[[], bool]] = {
        "openai": settings.is_openai_available,
        "anthropic": settings.is_anthropic_available,
        "cohere": settings.is_cohere_available,
        "jina": settings.is_jina_available,
        "voyage": settings.is_voyage_available,
        "ollama": lambda: True,  # Ollama doesn't need API key
    }
    check_func = provider_checks.get(provider.lower())
    return check_func() if check_func else False


@router.get(
    "/validate",
    response_model=SetupValidationResponse,
    summary="Validate setup",
    description="Check if the system is properly configured with required API keys and services.",
)
async def validate_setup(repo: SettingsRepo) -> SetupValidationResponse:
    """
    Validate that the system is properly configured for operation.

    Cross-validates DB Settings against env configuration to ensure:
    - Selected providers have corresponding API keys configured
    - Required infrastructure settings are present

    Checks:
    - Embedding model provider has required API key
    - Answer provider has required API key
    - Evaluation judge provider has required API key
    - Reranker provider has required API key (if applicable)
    """
    settings = get_app_config()
    app_settings = await repo.get()
    checks: list[SetupValidationItem] = []
    has_critical_error = False

    # ==========================================================================
    # Cross-validation: Embedding Model Provider
    # ==========================================================================
    embedding_provider = _get_embedding_provider(app_settings.embedding_model)
    embedding_key_available = _check_provider_api_key(embedding_provider, settings)

    if embedding_key_available:
        checks.append(
            SetupValidationItem(
                name="Embedding Provider",
                status="ok",
                message=f"Using {embedding_provider} ({app_settings.embedding_model})",
                required=True,
            )
        )
    else:
        has_critical_error = True
        env_var = f"{embedding_provider.upper()}_API_KEY"
        checks.append(
            SetupValidationItem(
                name="Embedding Provider",
                status="error",
                message=f"Embedding model '{app_settings.embedding_model}' requires {env_var} - add key or change model in Settings",
                required=True,
            )
        )

    # ==========================================================================
    # Cross-validation: Answer Provider
    # ==========================================================================
    answer_key_available = _check_provider_api_key(app_settings.answer_provider, settings)

    if answer_key_available:
        checks.append(
            SetupValidationItem(
                name="Answer Provider",
                status="ok",
                message=f"Using {app_settings.answer_provider} ({app_settings.answer_model}) for AI answers",
                required=True,
            )
        )
    else:
        has_critical_error = True
        env_var = f"{app_settings.answer_provider.upper()}_API_KEY"
        checks.append(
            SetupValidationItem(
                name="Answer Provider",
                status="error",
                message=f"Answer provider '{app_settings.answer_provider}' requires {env_var} - add key or change provider in Settings",
                required=True,
            )
        )

    # ==========================================================================
    # Cross-validation: Evaluation Judge Provider
    # ==========================================================================
    if app_settings.eval_judge_provider == "disabled":
        checks.append(
            SetupValidationItem(
                name="Evaluation LLM",
                status="not_configured",
                message="Evaluations are disabled in settings",
                required=False,
            )
        )
    else:
        eval_key_available = _check_provider_api_key(app_settings.eval_judge_provider, settings)

        if eval_key_available:
            checks.append(
                SetupValidationItem(
                    name="Evaluation Provider",
                    status="ok",
                    message=f"Using {app_settings.eval_judge_provider} ({app_settings.eval_judge_model}) for evaluations",
                    required=False,
                )
            )
        else:
            env_var = f"{app_settings.eval_judge_provider.upper()}_API_KEY"
            checks.append(
                SetupValidationItem(
                    name="Evaluation Provider",
                    status="warning",
                    message=f"Evaluation provider '{app_settings.eval_judge_provider}' requires {env_var} - add key or change provider in Settings",
                    required=False,
                )
            )

    # ==========================================================================
    # Cross-validation: Reranker Provider
    # ==========================================================================
    if app_settings.reranker_provider == "jina":
        # Jina reranker is local, always available
        checks.append(
            SetupValidationItem(
                name="Reranker",
                status="ok",
                message="Using Jina reranker (local, no API key required)",
                required=False,
            )
        )
    elif app_settings.reranker_provider == "cohere":
        if settings.is_cohere_available():
            checks.append(
                SetupValidationItem(
                    name="Reranker",
                    status="ok",
                    message="Using Cohere reranker",
                    required=False,
                )
            )
        else:
            checks.append(
                SetupValidationItem(
                    name="Reranker",
                    status="warning",
                    message="Reranker set to Cohere but COHERE_API_KEY missing - change to 'jina' or 'auto' in Settings",
                    required=False,
                )
            )
    elif app_settings.reranker_provider == "auto":
        # Auto mode - use Cohere if available, otherwise Jina
        if settings.is_cohere_available():
            checks.append(
                SetupValidationItem(
                    name="Reranker",
                    status="ok",
                    message="Using Cohere reranker (auto-detected from API key)",
                    required=False,
                )
            )
        else:
            checks.append(
                SetupValidationItem(
                    name="Reranker",
                    status="ok",
                    message="Using Jina reranker (auto fallback - no Cohere key)",
                    required=False,
                )
            )

    # ==========================================================================
    # Ollama availability check (for providers that use it)
    # ==========================================================================
    uses_ollama = (
        embedding_provider == "ollama"
        or app_settings.answer_provider == "ollama"
        or app_settings.eval_judge_provider == "ollama"
    )

    if uses_ollama:
        try:
            ollama_available = settings.check_ollama_available()
            if ollama_available:
                checks.append(
                    SetupValidationItem(
                        name="Ollama Server",
                        status="ok",
                        message=f"Local Ollama server reachable at {settings.ollama_base_url}",
                        required=True,
                    )
                )
            else:
                has_critical_error = True
                checks.append(
                    SetupValidationItem(
                        name="Ollama Server",
                        status="error",
                        message=f"Ollama server not reachable at {settings.ollama_base_url} - start with 'ollama serve' or change provider",
                        required=True,
                    )
                )
        except Exception as e:
            logger.warning(f"Error checking Ollama availability: {e}")
            checks.append(
                SetupValidationItem(
                    name="Ollama Server",
                    status="warning",
                    message=f"Could not check Ollama server at {settings.ollama_base_url}",
                    required=False,
                )
            )

    # ==========================================================================
    # Determine overall readiness
    # ==========================================================================
    ready = not has_critical_error

    # Generate summary
    if ready:
        warning_count = sum(1 for c in checks if c.status == "warning")
        if warning_count > 0:
            summary = f"Ready with {warning_count} warning(s) - some features may be limited"
        else:
            summary = "All systems configured and ready"
    else:
        error_count = sum(1 for c in checks if c.status == "error")
        summary = f"Not ready - {error_count} critical configuration issue(s) found"

    return SetupValidationResponse(
        ready=ready,
        checks=checks,
        summary=summary,
    )
