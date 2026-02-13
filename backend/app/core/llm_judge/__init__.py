"""LLM Judge module for evaluation.

Provides pluggable LLM-as-judge implementations for evaluating
retrieval and answer quality.
"""

from app.core.llm_judge.anthropic_judge import AnthropicJudge
from app.core.llm_judge.base import (
    AnswerEvalResult,
    BaseLLMJudge,
    EvaluationResult,
    RetrievalEvalResult,
)
from app.core.llm_judge.factory import JudgeFactory
from app.core.llm_judge.ollama_judge import OllamaJudge
from app.core.llm_judge.openai_judge import OpenAIJudge
from app.core.llm_judge.output_parser import (
    extract_json_text,
    parse_llm_json,
    parse_llm_json_array,
)
from app.core.llm_judge.schemas import (
    AnswerEvalOutput,
    GroundTruthOutput,
    RetrievalEvalOutput,
    VerificationItem,
    VerificationOutput,
)

__all__ = [
    # Base classes and results
    "BaseLLMJudge",
    "EvaluationResult",
    "RetrievalEvalResult",
    "AnswerEvalResult",
    # Factory
    "JudgeFactory",
    # Implementations
    "OpenAIJudge",
    "AnthropicJudge",
    "OllamaJudge",
    # Output parsing (M3C)
    "extract_json_text",
    "parse_llm_json",
    "parse_llm_json_array",
    # Output schemas (M3C)
    "RetrievalEvalOutput",
    "AnswerEvalOutput",
    "GroundTruthOutput",
    "VerificationItem",
    "VerificationOutput",
]
