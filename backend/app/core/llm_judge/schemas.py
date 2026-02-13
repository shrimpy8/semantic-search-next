"""
Pydantic output schemas for LLM judge responses (M3C — Security Hardening).

These schemas validate and normalize LLM output before it's used to construct
internal result dataclasses. They handle common LLM quirks:
- Scores as strings ("0.8") are coerced to floats
- Null scores default to 0.0
- Scores > 1.0 are clamped to 1.0
- Missing optional fields use safe defaults
- Extra fields are silently ignored

Usage:
    from app.core.llm_judge.schemas import RetrievalEvalOutput
    validated = RetrievalEvalOutput.model_validate(raw_dict)
"""

from pydantic import BaseModel, Field, field_validator


class RetrievalEvalOutput(BaseModel):
    """Expected JSON output from retrieval evaluation LLM call.

    Example:
        >>> RetrievalEvalOutput.model_validate({
        ...     "context_relevance": "0.8",
        ...     "context_precision": None,
        ... })
        RetrievalEvalOutput(context_relevance=0.8, context_precision=0.0, ...)
    """

    model_config = {"extra": "ignore"}

    context_relevance: float = Field(default=0.0)
    context_precision: float = Field(default=0.0)
    context_coverage: float = Field(default=0.0)
    reasoning: str = Field(default="")

    @field_validator("context_relevance", "context_precision", "context_coverage", mode="before")
    @classmethod
    def clamp_score(cls, v: object) -> float:
        if v is None:
            return 0.0
        return max(0.0, min(1.0, float(v)))


class AnswerEvalOutput(BaseModel):
    """Expected JSON output from answer evaluation LLM call.

    Example:
        >>> AnswerEvalOutput.model_validate({"faithfulness": 85})
        AnswerEvalOutput(faithfulness=1.0, ...)  # clamped
    """

    model_config = {"extra": "ignore"}

    faithfulness: float = Field(default=0.0)
    answer_relevance: float = Field(default=0.0)
    completeness: float = Field(default=0.0)
    reasoning: str = Field(default="")

    @field_validator("faithfulness", "answer_relevance", "completeness", mode="before")
    @classmethod
    def clamp_score(cls, v: object) -> float:
        if v is None:
            return 0.0
        return max(0.0, min(1.0, float(v)))


class GroundTruthOutput(BaseModel):
    """Expected JSON output from ground truth comparison LLM call.

    Example:
        >>> GroundTruthOutput.model_validate({"ground_truth_similarity": 0.75, "reasoning": "Similar"})
        GroundTruthOutput(ground_truth_similarity=0.75, reasoning='Similar')
    """

    model_config = {"extra": "ignore"}

    ground_truth_similarity: float = Field(default=0.0)
    reasoning: str = Field(default="")

    @field_validator("ground_truth_similarity", mode="before")
    @classmethod
    def clamp_score(cls, v: object) -> float:
        if v is None:
            return 0.0
        return max(0.0, min(1.0, float(v)))


class VerificationItem(BaseModel):
    """Single claim verification result from answer verifier.

    Example:
        >>> VerificationItem.model_validate({"claim_number": 1, "status": "SUPPORTED", "quote": "..."})
    """

    model_config = {"extra": "ignore"}

    claim_number: int = Field(ge=1)
    status: str = Field(default="NOT_SUPPORTED")
    source_index: int | None = None
    quote: str = Field(default="")

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v: object) -> str:
        if isinstance(v, str) and v.upper() in ("SUPPORTED", "NOT_SUPPORTED"):
            return v.upper()
        return "NOT_SUPPORTED"


class VerificationOutput(BaseModel):
    """Expected JSON output from claim verification (array wrapper).

    Example:
        >>> VerificationOutput.model_validate({"results": [{"claim_number": 1, "status": "SUPPORTED"}]})
    """

    model_config = {"extra": "ignore"}

    results: list[VerificationItem] = Field(default_factory=list)
