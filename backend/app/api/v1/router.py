"""
API v1 router aggregation.

Combines all v1 endpoints into a single router.
"""

from fastapi import APIRouter

from app.api.v1 import analytics, collections, documents, health, search, settings

# Create main v1 router
api_router = APIRouter()

# Include all routers
api_router.include_router(health.router)
api_router.include_router(collections.router)
api_router.include_router(documents.router)
api_router.include_router(search.router)
api_router.include_router(settings.router)
api_router.include_router(analytics.router)
