"""
Unit tests for trust boundary features (Task 3.T).

Tests the schema layers for trust boundary support:
- CollectionCreate/CollectionUpdate schema is_trusted handling
- CollectionResponse.from_model includes is_trusted
- SearchResultSchema.source_trusted field
- SearchResponse trust warning and sanitization fields
- Regression checks on existing schemas (DeletedResponse, etc.)

Run with: python tests/test_trust_boundaries.py
Or with pytest: pytest tests/test_trust_boundaries.py -v

No database connection required — tests schemas in isolation.
"""

import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import MagicMock

# Add parent directory to path for standalone execution
sys.path.insert(0, str(Path(__file__).parent.parent))

import pydantic
import pytest

from app.api.schemas import (
    CollectionCreate,
    CollectionResponse,
    CollectionUpdate,
    DeletedResponse,
    SearchResponse,
    SearchResultSchema,
    SearchScoresSchema,
)

# ============================================================================
# CollectionCreate Schema Tests
# ============================================================================


def test_collection_create_accepts_is_trusted_true():
    """CollectionCreate schema accepts is_trusted=True."""
    schema = CollectionCreate(name="Trusted Docs", is_trusted=True)
    assert schema.is_trusted is True


def test_collection_create_accepts_is_trusted_false():
    """CollectionCreate schema accepts is_trusted=False explicitly."""
    schema = CollectionCreate(name="Untrusted Docs", is_trusted=False)
    assert schema.is_trusted is False


def test_collection_create_defaults_is_trusted_to_false():
    """CollectionCreate schema defaults is_trusted to False when omitted."""
    schema = CollectionCreate(name="Default Collection")
    assert schema.is_trusted is False


def test_collection_create_all_fields():
    """CollectionCreate works with all fields populated including is_trusted."""
    schema = CollectionCreate(
        name="Full Collection",
        description="A fully specified collection",
        is_trusted=True,
    )
    assert schema.name == "Full Collection"
    assert schema.description == "A fully specified collection"
    assert schema.is_trusted is True


# ============================================================================
# CollectionUpdate Schema Tests
# ============================================================================


def test_collection_update_accepts_is_trusted():
    """CollectionUpdate schema accepts is_trusted as an optional field."""
    schema = CollectionUpdate(is_trusted=True)
    assert schema.is_trusted is True


def test_collection_update_is_trusted_defaults_to_none():
    """CollectionUpdate.is_trusted defaults to None (not provided)."""
    schema = CollectionUpdate()
    assert schema.is_trusted is None


def test_collection_update_is_trusted_false():
    """CollectionUpdate can explicitly set is_trusted to False."""
    schema = CollectionUpdate(is_trusted=False)
    assert schema.is_trusted is False


def test_collection_update_only_name():
    """CollectionUpdate with only name does not set is_trusted."""
    schema = CollectionUpdate(name="Renamed")
    assert schema.name == "Renamed"
    assert schema.is_trusted is None


# ============================================================================
# CollectionResponse.from_model Tests
# ============================================================================


def _make_mock_collection(is_trusted: bool = False) -> MagicMock:
    """Create a mock Collection model with all required fields."""
    mock = MagicMock()
    mock.id = uuid.uuid4()
    mock.name = "Test Collection"
    mock.description = "A test collection"
    mock.metadata_ = {}
    mock.settings = {}
    mock.is_trusted = is_trusted
    mock.document_count = 5
    mock.chunk_count = 100
    mock.created_at = datetime.now(UTC)
    mock.updated_at = datetime.now(UTC)
    return mock


def test_collection_response_from_model_trusted():
    """CollectionResponse.from_model correctly reads is_trusted=True."""
    mock = _make_mock_collection(is_trusted=True)
    response = CollectionResponse.from_model(mock)
    assert response.is_trusted is True


def test_collection_response_from_model_untrusted():
    """CollectionResponse.from_model correctly reads is_trusted=False."""
    mock = _make_mock_collection(is_trusted=False)
    response = CollectionResponse.from_model(mock)
    assert response.is_trusted is False


def test_collection_response_from_model_missing_is_trusted():
    """CollectionResponse.from_model falls back to False when is_trusted is missing.

    This tests the getattr(model, 'is_trusted', False) fallback for models
    that predate the is_trusted column (e.g., during migration).
    """
    mock = MagicMock(spec=[])  # Empty spec so getattr returns fallback
    mock.id = uuid.uuid4()
    mock.name = "Legacy Collection"
    mock.description = None
    mock.metadata_ = {}
    mock.settings = {}
    mock.document_count = 0
    mock.chunk_count = 0
    mock.created_at = datetime.now(UTC)
    mock.updated_at = datetime.now(UTC)
    # Deliberately do NOT set mock.is_trusted — getattr fallback should return False

    response = CollectionResponse.from_model(mock)
    assert response.is_trusted is False


def test_collection_response_from_model_preserves_other_fields():
    """CollectionResponse.from_model maps all standard fields correctly."""
    mock = _make_mock_collection(is_trusted=True)
    response = CollectionResponse.from_model(mock)

    assert response.id == mock.id
    assert response.name == mock.name
    assert response.description == mock.description
    assert response.document_count == mock.document_count
    assert response.chunk_count == mock.chunk_count
    assert response.created_at == mock.created_at
    assert response.updated_at == mock.updated_at


# ============================================================================
# SearchResultSchema Tests
# ============================================================================


def _make_search_result(**overrides) -> dict:
    """Create a valid SearchResultSchema dict with sensible defaults."""
    defaults = {
        "id": "chunk-001",
        "document_id": uuid.uuid4(),
        "document_name": "doc.pdf",
        "collection_id": uuid.uuid4(),
        "collection_name": "Test Collection",
        "content": "Some search result content.",
        "scores": SearchScoresSchema(
            semantic_score=0.85,
            bm25_score=0.60,
            rerank_score=0.78,
            final_score=0.78,
            relevance_percent=78,
        ),
    }
    defaults.update(overrides)
    return defaults


def test_search_result_has_source_trusted_field():
    """SearchResultSchema includes source_trusted field."""
    result = SearchResultSchema(**_make_search_result())
    assert hasattr(result, "source_trusted")


def test_search_result_source_trusted_defaults_false():
    """SearchResultSchema.source_trusted defaults to False."""
    result = SearchResultSchema(**_make_search_result())
    assert result.source_trusted is False


def test_search_result_source_trusted_true():
    """SearchResultSchema accepts source_trusted=True."""
    result = SearchResultSchema(**_make_search_result(source_trusted=True))
    assert result.source_trusted is True


def test_search_result_source_trusted_false_explicit():
    """SearchResultSchema accepts source_trusted=False explicitly."""
    result = SearchResultSchema(**_make_search_result(source_trusted=False))
    assert result.source_trusted is False


# ============================================================================
# SearchResponse Trust Warning Tests
# ============================================================================


def _make_search_response(**overrides) -> dict:
    """Create a valid SearchResponse dict with sensible defaults."""
    defaults = {
        "query": "test query",
        "results": [],
        "latency_ms": 42,
        "retrieval_method": "hybrid",
    }
    defaults.update(overrides)
    return defaults


def test_search_response_has_untrusted_sources_in_answer():
    """SearchResponse has untrusted_sources_in_answer field."""
    resp = SearchResponse(**_make_search_response())
    assert hasattr(resp, "untrusted_sources_in_answer")


def test_search_response_untrusted_sources_in_answer_defaults_false():
    """SearchResponse.untrusted_sources_in_answer defaults to False."""
    resp = SearchResponse(**_make_search_response())
    assert resp.untrusted_sources_in_answer is False


def test_search_response_untrusted_sources_in_answer_true():
    """SearchResponse accepts untrusted_sources_in_answer=True."""
    resp = SearchResponse(**_make_search_response(
        untrusted_sources_in_answer=True,
    ))
    assert resp.untrusted_sources_in_answer is True


def test_search_response_has_untrusted_source_names():
    """SearchResponse has untrusted_source_names field."""
    resp = SearchResponse(**_make_search_response())
    assert hasattr(resp, "untrusted_source_names")


def test_search_response_untrusted_source_names_defaults_empty():
    """SearchResponse.untrusted_source_names defaults to empty list."""
    resp = SearchResponse(**_make_search_response())
    assert resp.untrusted_source_names == []


def test_search_response_untrusted_source_names_with_values():
    """SearchResponse accepts untrusted_source_names with collection names."""
    names = ["User Uploads", "Web Scrapes"]
    resp = SearchResponse(**_make_search_response(
        untrusted_sources_in_answer=True,
        untrusted_source_names=names,
    ))
    assert resp.untrusted_source_names == names
    assert resp.untrusted_sources_in_answer is True


# ============================================================================
# SearchResponse Sanitization Field Tests
# ============================================================================


def test_search_response_has_sanitization_applied():
    """SearchResponse has sanitization_applied field."""
    resp = SearchResponse(**_make_search_response())
    assert hasattr(resp, "sanitization_applied")


def test_search_response_sanitization_applied_defaults_false():
    """SearchResponse.sanitization_applied defaults to False."""
    resp = SearchResponse(**_make_search_response())
    assert resp.sanitization_applied is False


def test_search_response_sanitization_applied_true():
    """SearchResponse accepts sanitization_applied=True."""
    resp = SearchResponse(**_make_search_response(
        sanitization_applied=True,
    ))
    assert resp.sanitization_applied is True


# ============================================================================
# Regression: DeletedResponse and Other Schemas Still Work
# ============================================================================


def test_deleted_response_still_works():
    """DeletedResponse schema still works correctly (regression check)."""
    resp = DeletedResponse(
        id=uuid.uuid4(),
        object="collection",
        deleted=True,
    )
    assert resp.deleted is True
    assert resp.object == "collection"


def test_deleted_response_defaults():
    """DeletedResponse.deleted defaults to True."""
    resp = DeletedResponse(id=uuid.uuid4(), object="document")
    assert resp.deleted is True


def test_search_scores_schema_still_works():
    """SearchScoresSchema still works correctly (regression check)."""
    scores = SearchScoresSchema(
        semantic_score=0.9,
        bm25_score=0.7,
        rerank_score=0.85,
        final_score=0.85,
        relevance_percent=85,
    )
    assert scores.final_score == 0.85
    assert scores.relevance_percent == 85


def test_collection_create_name_required():
    """CollectionCreate still requires name field (regression check)."""
    with pytest.raises(pydantic.ValidationError):
        CollectionCreate()


# ============================================================================
# SearchResponse Full Integration
# ============================================================================


def test_search_response_all_trust_fields_together():
    """SearchResponse correctly handles all trust-related fields simultaneously."""
    result_data = _make_search_result(source_trusted=False)
    result = SearchResultSchema(**result_data)

    resp = SearchResponse(**_make_search_response(
        results=[result],
        sanitization_applied=True,
        untrusted_sources_in_answer=True,
        untrusted_source_names=["User Uploads"],
    ))

    assert resp.sanitization_applied is True
    assert resp.untrusted_sources_in_answer is True
    assert resp.untrusted_source_names == ["User Uploads"]
    assert resp.results[0].source_trusted is False


def test_search_response_serialization_includes_trust_fields():
    """SearchResponse serializes trust fields in model_dump output."""
    resp = SearchResponse(**_make_search_response(
        untrusted_sources_in_answer=True,
        untrusted_source_names=["Uploads"],
        sanitization_applied=True,
    ))
    data = resp.model_dump()

    assert "untrusted_sources_in_answer" in data
    assert data["untrusted_sources_in_answer"] is True
    assert "untrusted_source_names" in data
    assert data["untrusted_source_names"] == ["Uploads"]
    assert "sanitization_applied" in data
    assert data["sanitization_applied"] is True


# ============================================================================
# Standalone runner
# ============================================================================


if __name__ == "__main__":
    import traceback

    tests = [
        # CollectionCreate tests
        test_collection_create_accepts_is_trusted_true,
        test_collection_create_accepts_is_trusted_false,
        test_collection_create_defaults_is_trusted_to_false,
        test_collection_create_all_fields,
        # CollectionUpdate tests
        test_collection_update_accepts_is_trusted,
        test_collection_update_is_trusted_defaults_to_none,
        test_collection_update_is_trusted_false,
        test_collection_update_only_name,
        # CollectionResponse.from_model tests
        test_collection_response_from_model_trusted,
        test_collection_response_from_model_untrusted,
        test_collection_response_from_model_missing_is_trusted,
        test_collection_response_from_model_preserves_other_fields,
        # SearchResultSchema tests
        test_search_result_has_source_trusted_field,
        test_search_result_source_trusted_defaults_false,
        test_search_result_source_trusted_true,
        test_search_result_source_trusted_false_explicit,
        # SearchResponse trust warning tests
        test_search_response_has_untrusted_sources_in_answer,
        test_search_response_untrusted_sources_in_answer_defaults_false,
        test_search_response_untrusted_sources_in_answer_true,
        test_search_response_has_untrusted_source_names,
        test_search_response_untrusted_source_names_defaults_empty,
        test_search_response_untrusted_source_names_with_values,
        # SearchResponse sanitization tests
        test_search_response_has_sanitization_applied,
        test_search_response_sanitization_applied_defaults_false,
        test_search_response_sanitization_applied_true,
        # Regression tests
        test_deleted_response_still_works,
        test_deleted_response_defaults,
        test_search_scores_schema_still_works,
        test_collection_create_name_required,
        # Integration tests
        test_search_response_all_trust_fields_together,
        test_search_response_serialization_includes_trust_fields,
    ]

    passed = 0
    failed = 0

    print("=" * 60)
    print("Running Trust Boundary Tests (Standalone)")
    print("=" * 60)

    for test in tests:
        try:
            test()
            print(f"  PASS  {test.__name__}")
            passed += 1
        except AssertionError as exc:
            print(f"  FAIL  {test.__name__}: {exc}")
            failed += 1
        except Exception:
            print(f"  FAIL  {test.__name__}: {traceback.format_exc()}")
            failed += 1

    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed, {passed + failed} total")
    print("=" * 60)

    sys.exit(0 if failed == 0 else 1)
