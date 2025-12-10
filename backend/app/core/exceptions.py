"""Custom exceptions for the application."""


class SemanticSearchError(Exception):
    """Base exception for semantic search errors."""

    pass


# ============================================================================
# Evaluation Exceptions
# ============================================================================


class EvaluationError(SemanticSearchError):
    """Base exception for evaluation errors."""

    pass


class JudgeUnavailableError(EvaluationError):
    """Raised when an LLM judge is not available."""

    def __init__(self, provider: str, reason: str | None = None):
        self.provider = provider
        self.reason = reason
        message = f"Judge provider '{provider}' is not available"
        if reason:
            message += f": {reason}"
        super().__init__(message)


class JudgeResponseError(EvaluationError):
    """Raised when the judge returns an invalid response."""

    def __init__(self, message: str, raw_response: str | None = None):
        self.raw_response = raw_response
        super().__init__(message)


class PromptParseError(EvaluationError):
    """Raised when prompt parsing fails."""

    pass


class EvaluationTimeoutError(EvaluationError):
    """Raised when evaluation times out."""

    def __init__(self, timeout_seconds: int):
        self.timeout_seconds = timeout_seconds
        super().__init__(f"Evaluation timed out after {timeout_seconds} seconds")
