"""
ChromaDB filter helpers.

Centralizes filter construction to avoid duplicate logic.
"""

from typing import Any
from uuid import UUID


def build_chromadb_filter(
    collection_id: UUID | str | None,
    document_ids: list[UUID | str] | None,
) -> dict[str, Any] | None:
    """
    Build ChromaDB filter from search request parameters.

    Uses explicit $eq/$in operators as required by ChromaDB.
    """
    conditions: list[dict[str, Any]] = []

    if collection_id:
        conditions.append({"collection_id": {"$eq": str(collection_id)}})

    if document_ids:
        if len(document_ids) == 1:
            conditions.append({"document_id": {"$eq": str(document_ids[0])}})
        else:
            conditions.append({"document_id": {"$in": [str(d) for d in document_ids]}})

    if not conditions:
        return None
    if len(conditions) == 1:
        return conditions[0]
    return {"$and": conditions}
