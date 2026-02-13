"""
Standalone tests for LLM judge Pydantic output schemas.

Run with: python tests/test_llm_judge_schemas.py
Or with pytest: pytest tests/test_llm_judge_schemas.py -v

No app dependencies required - this tests the schemas in isolation.
"""

import sys
from pathlib import Path

# Add parent directory to path for standalone execution
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from pydantic import ValidationError

from app.core.llm_judge.schemas import (  # noqa: E402
    AnswerEvalOutput,
    GroundTruthOutput,
    RetrievalEvalOutput,
    VerificationItem,
    VerificationOutput,
)

# ---------------------------------------------------------------------------
# RetrievalEvalOutput
# ---------------------------------------------------------------------------


def test_retrieval_eval_valid_complete():
    """Valid complete input sets all fields correctly."""
    data = {
        "context_relevance": 0.85,
        "context_precision": 0.7,
        "context_coverage": 0.9,
        "reasoning": "Good retrieval quality.",
    }
    result = RetrievalEvalOutput.model_validate(data)
    assert result.context_relevance == 0.85
    assert result.context_precision == 0.7
    assert result.context_coverage == 0.9
    assert result.reasoning == "Good retrieval quality."


def test_retrieval_eval_empty_dict_defaults():
    """Empty dict uses defaults: 0.0 for scores, empty string for reasoning."""
    result = RetrievalEvalOutput.model_validate({})
    assert result.context_relevance == 0.0
    assert result.context_precision == 0.0
    assert result.context_coverage == 0.0
    assert result.reasoning == ""


def test_retrieval_eval_string_scores_coerced():
    """String scores are coerced to float."""
    data = {"context_relevance": "0.8", "context_precision": "0.5", "context_coverage": "0.3"}
    result = RetrievalEvalOutput.model_validate(data)
    assert result.context_relevance == 0.8
    assert result.context_precision == 0.5
    assert result.context_coverage == 0.3


def test_retrieval_eval_none_scores_default():
    """None scores become 0.0."""
    data = {"context_relevance": None, "context_precision": None, "context_coverage": None}
    result = RetrievalEvalOutput.model_validate(data)
    assert result.context_relevance == 0.0
    assert result.context_precision == 0.0
    assert result.context_coverage == 0.0


def test_retrieval_eval_score_clamped_above_one():
    """Scores greater than 1.0 are clamped to 1.0."""
    data = {"context_relevance": 85, "context_precision": 1.5, "context_coverage": 100}
    result = RetrievalEvalOutput.model_validate(data)
    assert result.context_relevance == 1.0
    assert result.context_precision == 1.0
    assert result.context_coverage == 1.0


def test_retrieval_eval_negative_score_clamped():
    """Negative scores are clamped to 0.0."""
    data = {"context_relevance": -0.5, "context_precision": -10, "context_coverage": -0.001}
    result = RetrievalEvalOutput.model_validate(data)
    assert result.context_relevance == 0.0
    assert result.context_precision == 0.0
    assert result.context_coverage == 0.0


def test_retrieval_eval_extra_fields_ignored():
    """Extra fields are silently ignored (extra='ignore')."""
    data = {"context_relevance": 0.5, "unknown_field": "foo", "another_extra": 42}
    result = RetrievalEvalOutput.model_validate(data)
    assert result.context_relevance == 0.5
    assert not hasattr(result, "unknown_field")
    assert not hasattr(result, "another_extra")


# ---------------------------------------------------------------------------
# AnswerEvalOutput
# ---------------------------------------------------------------------------


def test_answer_eval_valid_complete():
    """Valid complete input sets all fields correctly."""
    data = {
        "faithfulness": 0.9,
        "answer_relevance": 0.75,
        "completeness": 0.8,
        "reasoning": "Answer is well-supported.",
    }
    result = AnswerEvalOutput.model_validate(data)
    assert result.faithfulness == 0.9
    assert result.answer_relevance == 0.75
    assert result.completeness == 0.8
    assert result.reasoning == "Answer is well-supported."


def test_answer_eval_score_clamping():
    """Score clamping works the same as RetrievalEvalOutput."""
    data = {
        "faithfulness": 85,
        "answer_relevance": -0.3,
        "completeness": None,
    }
    result = AnswerEvalOutput.model_validate(data)
    assert result.faithfulness == 1.0
    assert result.answer_relevance == 0.0
    assert result.completeness == 0.0


def test_answer_eval_empty_dict_defaults():
    """Empty dict uses defaults."""
    result = AnswerEvalOutput.model_validate({})
    assert result.faithfulness == 0.0
    assert result.answer_relevance == 0.0
    assert result.completeness == 0.0
    assert result.reasoning == ""


def test_answer_eval_string_scores_coerced():
    """String scores are coerced to float."""
    data = {"faithfulness": "0.6", "answer_relevance": "0.9", "completeness": "0.1"}
    result = AnswerEvalOutput.model_validate(data)
    assert result.faithfulness == 0.6
    assert result.answer_relevance == 0.9
    assert result.completeness == 0.1


def test_answer_eval_extra_fields_ignored():
    """Extra fields are silently ignored."""
    data = {"faithfulness": 0.5, "bonus_metric": 0.99}
    result = AnswerEvalOutput.model_validate(data)
    assert result.faithfulness == 0.5
    assert not hasattr(result, "bonus_metric")


# ---------------------------------------------------------------------------
# GroundTruthOutput
# ---------------------------------------------------------------------------


def test_ground_truth_valid_input():
    """Valid input sets fields correctly."""
    data = {"ground_truth_similarity": 0.75, "reasoning": "Similar content."}
    result = GroundTruthOutput.model_validate(data)
    assert result.ground_truth_similarity == 0.75
    assert result.reasoning == "Similar content."


def test_ground_truth_score_clamping():
    """Score clamping works for ground truth similarity."""
    # Above 1.0
    result_high = GroundTruthOutput.model_validate({"ground_truth_similarity": 50})
    assert result_high.ground_truth_similarity == 1.0

    # Negative
    result_neg = GroundTruthOutput.model_validate({"ground_truth_similarity": -0.2})
    assert result_neg.ground_truth_similarity == 0.0

    # None
    result_none = GroundTruthOutput.model_validate({"ground_truth_similarity": None})
    assert result_none.ground_truth_similarity == 0.0

    # String
    result_str = GroundTruthOutput.model_validate({"ground_truth_similarity": "0.65"})
    assert result_str.ground_truth_similarity == 0.65


def test_ground_truth_empty_dict_defaults():
    """Empty dict uses defaults."""
    result = GroundTruthOutput.model_validate({})
    assert result.ground_truth_similarity == 0.0
    assert result.reasoning == ""


def test_ground_truth_extra_fields_ignored():
    """Extra fields are silently ignored."""
    data = {"ground_truth_similarity": 0.5, "reasoning": "OK", "extra": True}
    result = GroundTruthOutput.model_validate(data)
    assert not hasattr(result, "extra")


# ---------------------------------------------------------------------------
# VerificationItem
# ---------------------------------------------------------------------------


def test_verification_item_valid_supported():
    """Valid input with SUPPORTED status is normalized to uppercase."""
    data = {"claim_number": 1, "status": "SUPPORTED", "source_index": 0, "quote": "The sky is blue."}
    result = VerificationItem.model_validate(data)
    assert result.claim_number == 1
    assert result.status == "SUPPORTED"
    assert result.source_index == 0
    assert result.quote == "The sky is blue."


def test_verification_item_invalid_status_defaults():
    """Invalid status (e.g. 'MAYBE') defaults to 'NOT_SUPPORTED'."""
    data = {"claim_number": 2, "status": "MAYBE"}
    result = VerificationItem.model_validate(data)
    assert result.status == "NOT_SUPPORTED"


def test_verification_item_lowercase_supported_normalized():
    """Lowercase 'supported' is normalized to uppercase 'SUPPORTED'."""
    data = {"claim_number": 1, "status": "supported"}
    result = VerificationItem.model_validate(data)
    assert result.status == "SUPPORTED"


def test_verification_item_lowercase_not_supported_normalized():
    """Lowercase 'not_supported' is normalized to uppercase 'NOT_SUPPORTED'."""
    data = {"claim_number": 1, "status": "not_supported"}
    result = VerificationItem.model_validate(data)
    assert result.status == "NOT_SUPPORTED"


def test_verification_item_claim_number_less_than_one():
    """claim_number < 1 raises ValidationError (ge=1 constraint)."""
    with pytest.raises(ValidationError) as exc_info:
        VerificationItem.model_validate({"claim_number": 0, "status": "SUPPORTED"})
    errors = exc_info.value.errors()
    assert any(e["loc"] == ("claim_number",) for e in errors)


def test_verification_item_missing_claim_number():
    """Missing claim_number raises ValidationError (required field)."""
    with pytest.raises(ValidationError) as exc_info:
        VerificationItem.model_validate({"status": "SUPPORTED"})
    errors = exc_info.value.errors()
    assert any(e["loc"] == ("claim_number",) for e in errors)


def test_verification_item_defaults():
    """Optional fields use their defaults when not provided."""
    data = {"claim_number": 3}
    result = VerificationItem.model_validate(data)
    assert result.status == "NOT_SUPPORTED"
    assert result.source_index is None
    assert result.quote == ""


def test_verification_item_non_string_status_defaults():
    """Non-string status (e.g., int, None) defaults to 'NOT_SUPPORTED'."""
    result_int = VerificationItem.model_validate({"claim_number": 1, "status": 42})
    assert result_int.status == "NOT_SUPPORTED"

    result_none = VerificationItem.model_validate({"claim_number": 1, "status": None})
    assert result_none.status == "NOT_SUPPORTED"


def test_verification_item_extra_fields_ignored():
    """Extra fields are silently ignored."""
    data = {"claim_number": 1, "status": "SUPPORTED", "confidence": 0.99}
    result = VerificationItem.model_validate(data)
    assert not hasattr(result, "confidence")


# ---------------------------------------------------------------------------
# VerificationOutput
# ---------------------------------------------------------------------------


def test_verification_output_valid_results():
    """Valid results array is parsed correctly."""
    data = {
        "results": [
            {"claim_number": 1, "status": "SUPPORTED", "source_index": 0, "quote": "Evidence A."},
            {"claim_number": 2, "status": "NOT_SUPPORTED", "quote": "No evidence."},
            {"claim_number": 3, "status": "supported", "source_index": 2, "quote": "Evidence C."},
        ]
    }
    result = VerificationOutput.model_validate(data)
    assert len(result.results) == 3
    assert result.results[0].status == "SUPPORTED"
    assert result.results[0].claim_number == 1
    assert result.results[0].source_index == 0
    assert result.results[1].status == "NOT_SUPPORTED"
    assert result.results[1].source_index is None
    assert result.results[2].status == "SUPPORTED"  # normalized from lowercase


def test_verification_output_empty_results_default():
    """Empty results defaults to empty list."""
    result = VerificationOutput.model_validate({})
    assert result.results == []
    assert len(result.results) == 0


def test_verification_output_empty_results_explicit():
    """Explicit empty results array works."""
    result = VerificationOutput.model_validate({"results": []})
    assert result.results == []


def test_verification_output_mixed_valid_invalid_items():
    """Mixed valid and invalid statuses in results are each validated."""
    data = {
        "results": [
            {"claim_number": 1, "status": "SUPPORTED"},
            {"claim_number": 2, "status": "MAYBE"},  # invalid -> NOT_SUPPORTED
            {"claim_number": 3, "status": "not_supported"},  # normalized
        ]
    }
    result = VerificationOutput.model_validate(data)
    assert len(result.results) == 3
    assert result.results[0].status == "SUPPORTED"
    assert result.results[1].status == "NOT_SUPPORTED"
    assert result.results[2].status == "NOT_SUPPORTED"


def test_verification_output_invalid_item_in_results():
    """An item with invalid claim_number in results raises ValidationError."""
    data = {
        "results": [
            {"claim_number": 1, "status": "SUPPORTED"},
            {"claim_number": 0, "status": "SUPPORTED"},  # invalid: ge=1
        ]
    }
    with pytest.raises(ValidationError):
        VerificationOutput.model_validate(data)


def test_verification_output_extra_fields_ignored():
    """Extra fields on VerificationOutput are silently ignored."""
    data = {"results": [], "metadata": {"version": 2}}
    result = VerificationOutput.model_validate(data)
    assert result.results == []
    assert not hasattr(result, "metadata")


# ---------------------------------------------------------------------------
# Standalone runner
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import traceback

    tests = [
        # RetrievalEvalOutput
        test_retrieval_eval_valid_complete,
        test_retrieval_eval_empty_dict_defaults,
        test_retrieval_eval_string_scores_coerced,
        test_retrieval_eval_none_scores_default,
        test_retrieval_eval_score_clamped_above_one,
        test_retrieval_eval_negative_score_clamped,
        test_retrieval_eval_extra_fields_ignored,
        # AnswerEvalOutput
        test_answer_eval_valid_complete,
        test_answer_eval_score_clamping,
        test_answer_eval_empty_dict_defaults,
        test_answer_eval_string_scores_coerced,
        test_answer_eval_extra_fields_ignored,
        # GroundTruthOutput
        test_ground_truth_valid_input,
        test_ground_truth_score_clamping,
        test_ground_truth_empty_dict_defaults,
        test_ground_truth_extra_fields_ignored,
        # VerificationItem
        test_verification_item_valid_supported,
        test_verification_item_invalid_status_defaults,
        test_verification_item_lowercase_supported_normalized,
        test_verification_item_lowercase_not_supported_normalized,
        test_verification_item_claim_number_less_than_one,
        test_verification_item_missing_claim_number,
        test_verification_item_defaults,
        test_verification_item_non_string_status_defaults,
        test_verification_item_extra_fields_ignored,
        # VerificationOutput
        test_verification_output_valid_results,
        test_verification_output_empty_results_default,
        test_verification_output_empty_results_explicit,
        test_verification_output_mixed_valid_invalid_items,
        test_verification_output_invalid_item_in_results,
        test_verification_output_extra_fields_ignored,
    ]

    passed = 0
    failed = 0

    print("=" * 60)
    print("Running LLM Judge Schema Tests (Standalone)")
    print("=" * 60)

    for test in tests:
        try:
            test()
            print(f"  PASS {test.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"  FAIL {test.__name__}: {e}")
            failed += 1
        except Exception:
            print(f"  FAIL {test.__name__}: {traceback.format_exc()}")
            failed += 1

    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)

    sys.exit(0 if failed == 0 else 1)
