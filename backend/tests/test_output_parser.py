"""
Standalone tests for the LLM output parser module.

Run with: python tests/test_output_parser.py
Or with pytest: pytest tests/test_output_parser.py -v

No app dependencies required - this tests the module in isolation.
"""

import json
import sys
from pathlib import Path

# Add parent directory to path for standalone execution
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest

from app.core.exceptions import JudgeResponseError
from app.core.llm_judge.output_parser import (
    extract_json_text,
    parse_llm_json,
    parse_llm_json_array,
)
from app.core.llm_judge.schemas import RetrievalEvalOutput, VerificationItem

# ---------------------------------------------------------------------------
# extract_json_text tests
# ---------------------------------------------------------------------------


def test_extract_json_text_valid_object():
    """Test 1: Valid JSON object string is returned as-is."""
    raw = '{"score": 0.8, "reasoning": "good"}'
    result = extract_json_text(raw)
    assert json.loads(result) == {"score": 0.8, "reasoning": "good"}


def test_extract_json_text_valid_array():
    """Test 2: Valid JSON array string is returned as-is."""
    raw = '[{"id": 1}, {"id": 2}]'
    result = extract_json_text(raw)
    assert json.loads(result) == [{"id": 1}, {"id": 2}]


def test_extract_json_text_json_code_block():
    """Test 3: ```json code block extracts inner JSON."""
    raw = 'Here is the output:\n```json\n{"context_relevance": 0.9}\n```\nDone.'
    result = extract_json_text(raw)
    assert json.loads(result) == {"context_relevance": 0.9}


def test_extract_json_text_plain_code_block():
    """Test 4: ``` code block (no json tag) extracts inner JSON."""
    raw = 'Result:\n```\n{"context_relevance": 0.7, "reasoning": "decent"}\n```'
    result = extract_json_text(raw)
    assert json.loads(result) == {"context_relevance": 0.7, "reasoning": "decent"}


def test_extract_json_text_json_embedded_in_prose():
    """Test 5: JSON object embedded in prose text is extracted."""
    raw = 'Here is the result: {"score": 0.8} Hope that helps'
    result = extract_json_text(raw)
    assert json.loads(result) == {"score": 0.8}


def test_extract_json_text_array_embedded_in_prose():
    """Test 6: JSON array embedded in prose text is extracted.

    Uses an array of primitives to avoid ambiguity with object extraction
    (strategy 4 tries { } boundaries before [ ] boundaries).
    """
    raw = 'Results: [1, 2, 3] Done.'
    result = extract_json_text(raw)
    assert json.loads(result) == [1, 2, 3]


def test_extract_json_text_empty_string():
    """Test 7: Empty string raises JudgeResponseError."""
    with pytest.raises(JudgeResponseError):
        extract_json_text("")


def test_extract_json_text_no_json():
    """Test 8: Plain text with no JSON raises JudgeResponseError."""
    with pytest.raises(JudgeResponseError):
        extract_json_text("This is just plain text with no JSON")


def test_extract_json_text_whitespace_only():
    """Test 9: Whitespace-only string raises JudgeResponseError."""
    with pytest.raises(JudgeResponseError):
        extract_json_text("   \n\t  ")


# ---------------------------------------------------------------------------
# parse_llm_json tests
# ---------------------------------------------------------------------------


def test_parse_llm_json_valid_complete():
    """Test 10: Valid complete JSON returns validated model with all fields."""
    raw = json.dumps({
        "context_relevance": 0.85,
        "context_precision": 0.72,
        "context_coverage": 0.60,
        "reasoning": "The retrieved context is highly relevant.",
    })
    result = parse_llm_json(raw, RetrievalEvalOutput)

    assert isinstance(result, RetrievalEvalOutput)
    assert result.context_relevance == 0.85
    assert result.context_precision == 0.72
    assert result.context_coverage == 0.60
    assert result.reasoning == "The retrieved context is highly relevant."


def test_parse_llm_json_partial_with_defaults():
    """Test 11: Partial JSON with allow_partial=True fills missing fields with defaults."""
    raw = '{"context_relevance": 0.9}'
    result = parse_llm_json(raw, RetrievalEvalOutput, allow_partial=True)

    assert isinstance(result, RetrievalEvalOutput)
    assert result.context_relevance == 0.9
    assert result.context_precision == 0.0
    assert result.context_coverage == 0.0
    assert result.reasoning == ""


def test_parse_llm_json_invalid_strict_raises():
    """Test 12: Invalid JSON with allow_partial=False raises JudgeResponseError."""
    # VerificationItem requires claim_number (int, ge=1) with no default,
    # so an empty object will fail validation.
    raw = '{"status": "SUPPORTED"}'
    with pytest.raises(JudgeResponseError):
        parse_llm_json(raw, VerificationItem, allow_partial=False)


def test_parse_llm_json_score_as_string():
    """Test 13: Score provided as string '0.8' is coerced to float 0.8."""
    raw = json.dumps({
        "context_relevance": "0.8",
        "context_precision": "0.5",
        "context_coverage": "0.3",
        "reasoning": "Coercion test",
    })
    result = parse_llm_json(raw, RetrievalEvalOutput)

    assert result.context_relevance == 0.8
    assert result.context_precision == 0.5
    assert result.context_coverage == 0.3


def test_parse_llm_json_score_clamped():
    """Test 14: Score > 1.0 (e.g. 85) is clamped to 1.0 by clamp_score validator."""
    raw = json.dumps({
        "context_relevance": 85,
        "context_precision": 1.5,
        "context_coverage": -0.2,
        "reasoning": "Out of range scores",
    })
    result = parse_llm_json(raw, RetrievalEvalOutput)

    assert result.context_relevance == 1.0
    assert result.context_precision == 1.0
    assert result.context_coverage == 0.0


# ---------------------------------------------------------------------------
# parse_llm_json_array tests
# ---------------------------------------------------------------------------


def test_parse_llm_json_array_valid():
    """Test 15: Valid array of items returns list of validated models."""
    raw = json.dumps([
        {"claim_number": 1, "status": "SUPPORTED", "source_index": 0, "quote": "Evidence A"},
        {"claim_number": 2, "status": "NOT_SUPPORTED", "source_index": None, "quote": ""},
    ])
    result = parse_llm_json_array(raw, VerificationItem)

    assert len(result) == 2
    assert all(isinstance(item, VerificationItem) for item in result)
    assert result[0].claim_number == 1
    assert result[0].status == "SUPPORTED"
    assert result[0].source_index == 0
    assert result[0].quote == "Evidence A"
    assert result[1].claim_number == 2
    assert result[1].status == "NOT_SUPPORTED"
    assert result[1].source_index is None


def test_parse_llm_json_array_unwraps_results_key():
    """Test 16: Dict with 'results' key unwraps and returns the array."""
    raw = json.dumps({
        "results": [
            {"claim_number": 1, "status": "SUPPORTED", "quote": "Found it."},
            {"claim_number": 2, "status": "NOT_SUPPORTED"},
        ]
    })
    result = parse_llm_json_array(raw, VerificationItem)

    assert len(result) == 2
    assert result[0].claim_number == 1
    assert result[0].status == "SUPPORTED"
    assert result[1].claim_number == 2
    assert result[1].status == "NOT_SUPPORTED"


def test_parse_llm_json_array_skips_invalid():
    """Test 17: Invalid items in array are skipped, valid items returned."""
    raw = json.dumps([
        {"claim_number": 1, "status": "SUPPORTED"},
        {"invalid_field": "no claim_number"},  # Missing required claim_number
        {"claim_number": 3, "status": "NOT_SUPPORTED"},
    ])
    result = parse_llm_json_array(raw, VerificationItem)

    assert len(result) == 2
    assert result[0].claim_number == 1
    assert result[1].claim_number == 3


def test_parse_llm_json_array_non_array():
    """Test 18: Non-array JSON (without 'results' key) returns empty list."""
    raw = '{"claim_number": 1, "status": "SUPPORTED"}'
    result = parse_llm_json_array(raw, VerificationItem)

    assert result == []


def test_parse_llm_json_array_empty():
    """Test 19: Empty array returns empty list."""
    raw = "[]"
    result = parse_llm_json_array(raw, VerificationItem)

    assert result == []
    assert isinstance(result, list)


# ---------------------------------------------------------------------------
# Standalone runner
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    import traceback

    tests = [
        # extract_json_text
        test_extract_json_text_valid_object,
        test_extract_json_text_valid_array,
        test_extract_json_text_json_code_block,
        test_extract_json_text_plain_code_block,
        test_extract_json_text_json_embedded_in_prose,
        test_extract_json_text_array_embedded_in_prose,
        test_extract_json_text_empty_string,
        test_extract_json_text_no_json,
        test_extract_json_text_whitespace_only,
        # parse_llm_json
        test_parse_llm_json_valid_complete,
        test_parse_llm_json_partial_with_defaults,
        test_parse_llm_json_invalid_strict_raises,
        test_parse_llm_json_score_as_string,
        test_parse_llm_json_score_clamped,
        # parse_llm_json_array
        test_parse_llm_json_array_valid,
        test_parse_llm_json_array_unwraps_results_key,
        test_parse_llm_json_array_skips_invalid,
        test_parse_llm_json_array_non_array,
        test_parse_llm_json_array_empty,
    ]

    passed = 0
    failed = 0

    print("=" * 60)
    print("Running Output Parser Tests (Standalone)")
    print("=" * 60)

    for test in tests:
        try:
            test()
            print(f"  PASS  {test.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"  FAIL  {test.__name__}: {e}")
            failed += 1
        except Exception:
            print(f"  FAIL  {test.__name__}: {traceback.format_exc()}")
            failed += 1

    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)

    sys.exit(0 if failed == 0 else 1)
