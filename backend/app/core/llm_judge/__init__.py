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
]
