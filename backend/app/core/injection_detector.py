"""
Injection Pattern Detector (Observability-Only)

Detects common prompt injection patterns in text content.
This module is READ-ONLY and NEVER modifies input data.

Purpose: Observability and logging only. Does NOT block or filter content.

Usage:
    detector = InjectionDetector()
    result = detector.scan_text("some content here")
    # result = {"detected": False, "patterns": [], "score": 0.0}
"""

import logging
import re
from dataclasses import dataclass, field
from typing import ClassVar

logger = logging.getLogger(__name__)


@dataclass
class DetectionResult:
    """Result of scanning text for injection patterns."""

    detected: bool = False
    patterns: list[str] = field(default_factory=list)
    score: float = 0.0  # 0.0 = no detection, 1.0 = high confidence injection

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "detected": self.detected,
            "patterns": self.patterns,
            "score": self.score,
        }


class InjectionDetector:
    """
    Detects prompt injection patterns in text.

    This is an OBSERVABILITY-ONLY detector:
    - It scans text and returns detection results
    - It NEVER modifies the input
    - It NEVER blocks or filters content
    - Results are intended for logging and metrics

    Pattern Categories:
    1. Instruction override attempts ("ignore previous", "disregard")
    2. Role manipulation ("you are now", "act as")
    3. System prompt extraction ("repeat your instructions")
    4. Delimiter escaping (</system>, [INST])

    Example:
        >>> detector = InjectionDetector()
        >>> result = detector.scan_text("Ignore all previous instructions")
        >>> result.detected
        True
        >>> result.patterns
        ['instruction_override']
    """

    # Pattern definitions with categories and weights
    # Higher weight = more likely to be malicious
    PATTERNS: ClassVar[list[tuple[str, str, float]]] = [
        # Category: instruction_override (weight: 0.8)
        (r"ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)", "instruction_override", 0.8),
        (r"disregard\s+(all\s+)?(previous|prior|above|earlier|your)\s+(instructions?|prompts?|rules?)", "instruction_override", 0.8),
        (r"(please\s+)?disregard\s+(your\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)", "instruction_override", 0.8),
        (r"forget\s+(all\s+)?(previous|prior|above|earlier|your)\s+(instructions?|prompts?|context)", "instruction_override", 0.8),
        (r"do\s+not\s+follow\s+(the\s+)?(previous|prior|above|system)\s+(instructions?|prompts?)", "instruction_override", 0.8),

        # Category: role_manipulation (weight: 0.7)
        (r"you\s+are\s+now\s+(a|an|the)\s+", "role_manipulation", 0.7),
        (r"act\s+as\s+(a|an|if\s+you\s+were)\s+", "role_manipulation", 0.6),
        (r"pretend\s+(to\s+be|you\s+are)\s+", "role_manipulation", 0.7),
        (r"from\s+now\s+on[,\s]+(you|your)\s+", "role_manipulation", 0.6),

        # Category: system_extraction (weight: 0.9)
        (r"(repeat|show|print|display|reveal)\s+(me\s+)?(your|the)\s+(system\s+)?(instructions?|prompts?|rules?)", "system_extraction", 0.9),
        (r"show\s+me\s+(the\s+)?(system\s+)?(prompt|instructions?)", "system_extraction", 0.9),
        (r"what\s+(are|is)\s+your\s+(system\s+)?(instructions?|prompts?|rules?)", "system_extraction", 0.7),
        (r"(output|print)\s+(the\s+)?(above|previous)\s+(text|prompt|instructions?)", "system_extraction", 0.8),

        # Category: delimiter_escape (weight: 0.9)
        (r"</(system|user|assistant|instruction)>", "delimiter_escape", 0.9),
        (r"<(system|user|assistant|instruction)>", "delimiter_escape", 0.7),
        (r"\[/?INST\]", "delimiter_escape", 0.9),
        (r"\[/?SYS(TEM)?\]", "delimiter_escape", 0.9),
        (r"```\s*(system|instruction)", "delimiter_escape", 0.6),

        # Category: jailbreak_keywords (weight: 0.5 - lower confidence, needs context)
        (r"DAN\s+(mode|prompt)", "jailbreak_keywords", 0.5),
        (r"developer\s+mode\s+(enabled|activated)", "jailbreak_keywords", 0.6),
        (r"bypass\s+(the\s+)?(filter|safety|restriction)", "jailbreak_keywords", 0.7),
    ]

    def __init__(self):
        """Initialize detector with compiled regex patterns."""
        self._compiled_patterns: list[tuple[re.Pattern, str, float]] = []
        self._compile_patterns()

    def _compile_patterns(self) -> None:
        """Compile regex patterns for efficiency."""
        for pattern, category, weight in self.PATTERNS:
            try:
                compiled = re.compile(pattern, re.IGNORECASE | re.MULTILINE)
                self._compiled_patterns.append((compiled, category, weight))
            except re.error as e:
                logger.error(f"Failed to compile pattern '{pattern}': {e}")

    def scan_text(self, text: str) -> DetectionResult:
        """
        Scan text for injection patterns.

        Args:
            text: Text content to scan (NOT modified)

        Returns:
            DetectionResult with detection status, matched patterns, and score
        """
        if not text or not isinstance(text, str):
            return DetectionResult()

        matched_categories: set[str] = set()
        max_score: float = 0.0

        for compiled_pattern, category, weight in self._compiled_patterns:
            if compiled_pattern.search(text):
                matched_categories.add(category)
                max_score = max(max_score, weight)

        detected = len(matched_categories) > 0

        return DetectionResult(
            detected=detected,
            patterns=sorted(matched_categories),
            score=max_score,
        )

    def scan_texts(self, texts: list[str]) -> list[DetectionResult]:
        """
        Scan multiple texts for injection patterns.

        Args:
            texts: List of text content to scan (NOT modified)

        Returns:
            List of DetectionResult, one per input text
        """
        return [self.scan_text(text) for text in texts]

    def get_summary(self, results: list[DetectionResult]) -> dict:
        """
        Get summary statistics from multiple detection results.

        Args:
            results: List of DetectionResult from scan_texts()

        Returns:
            Summary dict with counts and max score
        """
        if not results:
            return {
                "total_scanned": 0,
                "total_detected": 0,
                "detection_rate": 0.0,
                "max_score": 0.0,
                "categories_found": [],
            }

        detected_count = sum(1 for r in results if r.detected)
        all_categories: set[str] = set()
        max_score = 0.0

        for r in results:
            all_categories.update(r.patterns)
            max_score = max(max_score, r.score)

        return {
            "total_scanned": len(results),
            "total_detected": detected_count,
            "detection_rate": detected_count / len(results) if results else 0.0,
            "max_score": max_score,
            "categories_found": sorted(all_categories),
        }
