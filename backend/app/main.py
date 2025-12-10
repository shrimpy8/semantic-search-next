"""FastAPI application entry point."""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.middleware import (
    RateLimitMiddleware,
    RequestLoggingMiddleware,
    api_error_handler,
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.api.v1 import api_router
from app.config import get_settings
from app.db import close_db, init_db

# Load settings first to determine log level
settings = get_settings()

# Configure logging based on DEBUG env variable
# DEBUG=true enables DEBUG level logging for detailed troubleshooting
# DEBUG=false (default) uses INFO level for production
log_level = logging.DEBUG if settings.debug else logging.INFO
logging.basicConfig(
    level=log_level,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    logger.info(f"Starting Semantic Search API v{app.version}")
    logger.info(f"Debug mode: {settings.debug}")
    logger.info(f"ChromaDB: {settings.chroma_url}")
    logger.info(f"PostgreSQL: {settings.postgres_host}:{settings.postgres_port}")

    # Initialize database (create tables if needed)
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.warning(f"Database initialization skipped: {e}")

    yield

    # Shutdown
    logger.info("Shutting down Semantic Search API")
    await close_db()


app = FastAPI(
    title="Semantic Search API",
    description="Production-grade semantic search with RAG capabilities",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=f"{settings.api_prefix}/docs",
    redoc_url=f"{settings.api_prefix}/redoc",
    openapi_url=f"{settings.api_prefix}/openapi.json",
)

# Exception handlers
from app.models.errors import APIError

app.add_exception_handler(APIError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Middleware (order matters - last added is first executed)
# 1. CORS must be outermost for preflight requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js dev server
        "http://localhost:3001",  # Next.js alt port
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
# 2. Rate limiting - protect against abuse
app.add_middleware(RateLimitMiddleware)
# 3. Request logging - track all requests
app.add_middleware(RequestLoggingMiddleware)

# Include API routers
app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/")
async def root() -> dict:
    """Root endpoint with API information."""
    return {
        "name": "Semantic Search API",
        "version": app.version,
        "docs": f"{settings.api_prefix}/docs",
        "health": f"{settings.api_prefix}/health",
    }
