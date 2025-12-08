"""
Health check endpoints.

Provides health and readiness checks for the API.
"""

import logging
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter
from sqlalchemy import text

from app.api.deps import DbSession
from app.api.schemas import HealthResponse
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health", tags=["health"])

settings = get_settings()


@router.get(
    "",
    response_model=HealthResponse,
    summary="Health check",
    description="Check if the API is healthy and responsive.",
)
async def health_check() -> HealthResponse:
    """Basic health check."""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(UTC),
        version="0.1.0",
        services={
            "api": "healthy",
        },
    )


async def check_database(db: DbSession) -> str:
    """Check database connectivity."""
    try:
        await db.execute(text("SELECT 1"))
        return "healthy"
    except Exception as e:
        logger.warning(f"Database health check failed: {e}")
        return "unhealthy"


async def check_chromadb() -> str:
    """Check ChromaDB connectivity."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Try v2 API first (newer ChromaDB), fall back to v1
            response = await client.get(f"{settings.chroma_url}/api/v2/heartbeat")
            if response.status_code == 200:
                return "healthy"
            # Fallback to v1 API
            response = await client.get(f"{settings.chroma_url}/api/v1/heartbeat")
            if response.status_code == 200:
                return "healthy"
            return "unhealthy"
    except Exception as e:
        logger.warning(f"ChromaDB health check failed: {e}")
        return "unhealthy"


@router.get(
    "/ready",
    response_model=HealthResponse,
    summary="Readiness check",
    description="Check if the API is ready to accept requests (all dependencies connected).",
)
async def readiness_check(db: DbSession) -> HealthResponse:
    """Readiness check including dependencies."""
    services: dict[str, str] = {"api": "healthy"}

    # Check database connection
    services["database"] = await check_database(db)

    # Check ChromaDB connection
    services["chromadb"] = await check_chromadb()

    all_healthy = all(s == "healthy" for s in services.values())

    return HealthResponse(
        status="healthy" if all_healthy else "degraded",
        timestamp=datetime.now(UTC),
        version="0.1.0",
        services=services,
    )
