"""
API middleware for error handling and request processing.
"""

import logging
import time
from collections import defaultdict
from uuid import uuid4

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Rate limiting configuration
RATE_LIMIT_REQUESTS = 60  # requests per window
RATE_LIMIT_WINDOW = 60  # window in seconds
RATE_LIMIT_UPLOAD_REQUESTS = 30  # uploads per window (increased for batch uploads)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple in-memory rate limiting middleware.

    Limits requests per IP address within a time window.
    For production, consider Redis-based rate limiting for distributed systems.
    """

    def __init__(self, app, requests_per_window: int = RATE_LIMIT_REQUESTS, window_seconds: int = RATE_LIMIT_WINDOW):
        super().__init__(app)
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds
        # Track requests: {ip: [(timestamp, endpoint), ...]}
        self._request_counts: dict[str, list[float]] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP from request, considering proxies."""
        # Check for forwarded header (if behind proxy/load balancer)
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _clean_old_requests(self, ip: str, current_time: float) -> None:
        """Remove requests outside the current window."""
        cutoff = current_time - self.window_seconds
        self._request_counts[ip] = [
            ts for ts in self._request_counts[ip] if ts > cutoff
        ]

    def _is_rate_limited(self, ip: str, current_time: float, limit: int) -> bool:
        """Check if IP has exceeded rate limit."""
        self._clean_old_requests(ip, current_time)
        return len(self._request_counts[ip]) >= limit

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path.startswith("/api/v1/health"):
            return await call_next(request)

        client_ip = self._get_client_ip(request)
        current_time = time.time()

        # Determine rate limit based on endpoint
        # More restrictive for uploads and search (expensive operations)
        if "/documents" in request.url.path and request.method == "POST":
            limit = RATE_LIMIT_UPLOAD_REQUESTS
        elif "/search" in request.url.path:
            limit = RATE_LIMIT_REQUESTS // 2  # 30 searches per minute
        else:
            limit = self.requests_per_window

        # Check rate limit
        if self._is_rate_limited(client_ip, current_time, limit):
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")

            # User-friendly message based on endpoint type
            if "/documents" in request.url.path:
                message = "Upload rate limit reached. Please wait a moment and try uploading fewer files at once."
            elif "/search" in request.url.path:
                message = "Search rate limit reached. Please wait a few seconds before searching again."
            else:
                message = "Too many requests. Please wait a moment before trying again."

            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "rate_limit_exceeded",
                    "message": message,
                    "status_code": 429,
                    "details": [],
                },
                headers={
                    "Retry-After": str(self.window_seconds),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(current_time + self.window_seconds)),
                },
            )

        # Track this request
        self._request_counts[client_ip].append(current_time)

        # Process request
        response = await call_next(request)

        # Add rate limit headers to response
        remaining = limit - len(self._request_counts[client_ip])
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        response.headers["X-RateLimit-Reset"] = str(int(current_time + self.window_seconds))

        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging requests and adding request IDs."""

    async def dispatch(self, request: Request, call_next):
        # Generate request ID
        request_id = str(uuid4())[:8]
        request.state.request_id = request_id

        # Log request
        start_time = time.perf_counter()
        logger.info(
            f"[{request_id}] {request.method} {request.url.path}"
        )

        # Process request
        response = await call_next(request)

        # Log response
        duration_ms = int((time.perf_counter() - start_time) * 1000)
        logger.info(
            f"[{request_id}] {response.status_code} ({duration_ms}ms)"
        )

        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id

        return response


async def validation_exception_handler(request: Request, exc):
    """Handle Pydantic validation errors."""
    from fastapi.exceptions import RequestValidationError

    if isinstance(exc, RequestValidationError):
        errors = exc.errors()
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "validation_error",
                "message": "Request validation failed",
                "status_code": 422,
                "details": [
                    {
                        "loc": list(e.get("loc", [])),
                        "msg": e.get("msg", ""),
                        "type": e.get("type", ""),
                    }
                    for e in errors
                ],
            },
        )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "internal_error",
            "message": str(exc),
            "status_code": 500,
            "details": [],
        },
    )


async def http_exception_handler(request: Request, exc):
    """Handle HTTP exceptions."""
    from fastapi import HTTPException

    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": "http_error",
                "message": exc.detail,
                "status_code": exc.status_code,
                "details": [],
            },
        )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "internal_error",
            "message": str(exc),
            "status_code": 500,
            "details": [],
        },
    )


async def generic_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.exception(f"Unhandled exception: {exc}")

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "internal_error",
            "message": "An unexpected error occurred",
            "status_code": 500,
            "details": [],
        },
    )


async def api_error_handler(request: Request, exc):
    """Handle custom API errors (ValidationError, NotFoundError, etc.)."""
    from app.models.errors import APIError

    if isinstance(exc, APIError):
        # Map error types to HTTP status codes
        status_map = {
            "validation_error": status.HTTP_400_BAD_REQUEST,
            "not_found": status.HTTP_404_NOT_FOUND,
            "duplicate": status.HTTP_409_CONFLICT,
            "limit_exceeded": status.HTTP_429_TOO_MANY_REQUESTS,
        }
        http_status = status_map.get(exc.code, status.HTTP_400_BAD_REQUEST)

        return JSONResponse(
            status_code=http_status,
            content={
                "error": exc.code,
                "message": exc.message,
                "status_code": http_status,
                "details": exc.details if exc.details else [],
                "param": exc.param,
            },
        )

    return await generic_exception_handler(request, exc)
