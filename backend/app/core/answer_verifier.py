"""
Answer Verification Module

Verifies that AI-generated answers are grounded in retrieved document context.
Extracts citations and calculates confidence scores to detect potential hallucinations.
"""

import logging
import os
import re
from dataclasses import dataclass, field
from typing import Any, cast

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from app.core.llm_judge.output_parser import parse_llm_json_array
from app.core.llm_judge.schemas import VerificationItem
from app.prompts import prompts

logger = logging.getLogger(__name__)


@dataclass
class Citation:
    """A citation linking an answer claim to a source document."""

    claim: str  # The claim/statement from the answer
    source_index: int  # Index of the source document (0-based)
    source_name: str  # Name of the source document
    quote: str  # Supporting quote from the document
    verified: bool = True  # Whether the claim is supported by the quote


@dataclass
class VerificationResult:
    """Result of verifying an AI-generated answer against source documents."""

    confidence: str  # "high", "medium", "low", or "unverified"
    citations: list[Citation] = field(default_factory=list)
    warning: str | None = None
    verified_claims: int = 0
    total_claims: int = 0
    coverage_percent: int = 0


class AnswerVerifier:
    """
    Verifies AI-generated answers against source documents.

    Uses a secondary LLM call to:
    1. Extract factual claims from the answer
    2. Verify each claim against the source context
    3. Calculate a confidence score based on claim coverage
    """

    def __init__(
        self,
        model_name: str = "gpt-4o-mini",
        temperature: float = 0.0,
        api_key: str | None = None,
    ):
        """
        Initialize the answer verifier.

        Args:
            model_name: LLM model for verification
            temperature: Model temperature (0.0 = deterministic)
            api_key: OpenAI API key (falls back to OPENAI_API_KEY env var)
        """
        # Get API key from param or environment
        key = api_key or os.getenv("OPENAI_API_KEY")
        if not key:
            raise ValueError("OpenAI API key not provided. Set OPENAI_API_KEY env var or pass api_key parameter.")

        self.llm = ChatOpenAI(
            model=model_name,
            temperature=temperature,
            api_key=cast(Any, key),
        )

        # Load prompts from external YAML files
        claim_extraction_system = prompts.get_raw("verification", "claim_extraction_system")
        claim_extraction_user = prompts.get_raw("verification", "claim_extraction_user")
        verification_system = prompts.get_raw("verification", "verification_system")
        verification_user = prompts.get_raw("verification", "verification_user")

        self.claim_prompt = ChatPromptTemplate.from_messages([
            ("system", claim_extraction_system),
            ("human", claim_extraction_user)
        ])
        self.verification_prompt = ChatPromptTemplate.from_messages([
            ("system", verification_system),
            ("human", verification_user)
        ])
        logger.info(f"Initialized AnswerVerifier with model={model_name}, prompts loaded from prompts/verification.yaml")

    def _extract_claims(self, answer: str) -> list[str]:
        """Extract factual claims from the answer."""
        try:
            prompt = self.claim_prompt.invoke({"answer": answer})
            response = self.llm.invoke(prompt)
            content = cast(str, response.content).strip()

            if content == "NO_CLAIMS":
                return []

            # Parse numbered list
            claims = []
            for line in content.split("\n"):
                line = line.strip()
                if line and re.match(r"^\d+\.", line):
                    # Remove number prefix
                    claim = re.sub(r"^\d+\.\s*", "", line).strip()
                    if claim:
                        claims.append(claim)

            logger.debug(f"Extracted {len(claims)} claims from answer")
            return claims

        except Exception as e:
            logger.error(f"Failed to extract claims: {e}")
            return []

    def _verify_claims(
        self,
        claims: list[str],
        context: str,
        sources: list[str],
    ) -> list[Citation]:
        """Verify claims against source context."""
        if not claims:
            return []

        try:
            # Format claims for prompt
            claims_text = "\n".join([f"{i+1}. {claim}" for i, claim in enumerate(claims)])

            prompt = self.verification_prompt.invoke({
                "context": context,
                "claims": claims_text,
            })
            response = self.llm.invoke(prompt)
            content = cast(str, response.content).strip()

            # Parse and validate with shared parser + Pydantic schema (M3C)
            verified_items = parse_llm_json_array(content, VerificationItem)

            # Convert to Citation objects
            citations = []
            for item in verified_items:
                claim_idx = item.claim_number - 1
                if 0 <= claim_idx < len(claims):
                    source_idx = item.source_index
                    source_name = sources[source_idx] if source_idx is not None and source_idx < len(sources) else "Unknown"

                    citations.append(Citation(
                        claim=claims[claim_idx],
                        source_index=source_idx if source_idx is not None else -1,
                        source_name=source_name,
                        quote=item.quote,
                        verified=item.status == "SUPPORTED",
                    ))

            logger.debug(f"Verified {len(citations)} claims")
            return citations

        except Exception as e:
            logger.error(f"Failed to verify claims: {e}")
            return []

    def _calculate_confidence(self, citations: list[Citation]) -> tuple[str, int]:
        """
        Calculate confidence level based on citation coverage.

        Returns:
            Tuple of (confidence_level, coverage_percent)
        """
        if not citations:
            return "unverified", 0

        verified_count = sum(1 for c in citations if c.verified)
        total = len(citations)
        coverage = int((verified_count / total) * 100) if total > 0 else 0

        # Determine confidence level
        if coverage >= 90:
            confidence = "high"
        elif coverage >= 60:
            confidence = "medium"
        elif coverage >= 30:
            confidence = "low"
        else:
            confidence = "unverified"

        return confidence, coverage

    def verify(
        self,
        answer: str,
        context: str,
        sources: list[str],
    ) -> VerificationResult:
        """
        Verify an AI-generated answer against source documents.

        Args:
            answer: The AI-generated answer to verify
            context: The concatenated source document context
            sources: List of source document names

        Returns:
            VerificationResult with confidence level, citations, and warnings
        """
        logger.info("Starting answer verification...")

        # Handle empty answer
        if not answer or not answer.strip():
            return VerificationResult(
                confidence="unverified",
                warning="No answer to verify",
            )

        # Handle "I don't know" type answers
        refusal_patterns = [
            r"i (?:can'?t|cannot|don'?t|do not) (?:answer|find|provide)",
            r"(?:no|not enough) (?:information|context|data)",
            r"i'?m (?:not sure|uncertain|unable)",
            r"the (?:documents?|sources?|context) (?:do(?:es)?n'?t|does not)",
        ]
        answer_lower = answer.lower()
        for pattern in refusal_patterns:
            if re.search(pattern, answer_lower):
                logger.info("Answer is a refusal - marking as high confidence")
                return VerificationResult(
                    confidence="high",
                    citations=[],
                    warning=None,
                    verified_claims=0,
                    total_claims=0,
                    coverage_percent=100,
                )

        # Extract claims from answer
        claims = self._extract_claims(answer)
        if not claims:
            logger.info("No factual claims found in answer")
            return VerificationResult(
                confidence="high",
                citations=[],
                warning=None,
                verified_claims=0,
                total_claims=0,
                coverage_percent=100,
            )

        # Verify claims against context
        citations = self._verify_claims(claims, context, sources)

        # Calculate confidence
        confidence, coverage = self._calculate_confidence(citations)
        verified_count = sum(1 for c in citations if c.verified)

        # Generate warning if needed
        warning = None
        if confidence in ("low", "unverified"):
            unverified = [c for c in citations if not c.verified]
            if unverified:
                warning = f"Could not verify {len(unverified)} claim(s) against your documents."

        result = VerificationResult(
            confidence=confidence,
            citations=citations,
            warning=warning,
            verified_claims=verified_count,
            total_claims=len(citations),
            coverage_percent=coverage,
        )

        logger.info(
            f"Verification complete: confidence={confidence} "
            f"verified={verified_count}/{len(citations)} coverage={coverage}%"
        )

        return result
