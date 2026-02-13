"""
Shared LLM output parser (M3C — Security Hardening).

Provides robust JSON extraction and Pydantic validation for all LLM
response paths (OpenAI/Anthropic/Ollama judges, answer verifier).

Replaces the duplicated _extract_json() methods in individual judges
with a single, well-tested utility.

Usage:
    from app.core.llm_judge.output_parser import parse_llm_json, parse_llm_json_array
    result = parse_llm_json(raw_text, RetrievalEvalOutput)
    items = parse_llm_json_array(raw_text, VerificationItem)
"""

import json
import logging
import re
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from app.core.exceptions import JudgeResponseError

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


def extract_json_text(raw: str) -> str:
    """Extract a JSON string from raw LLM output.

    Tries multiple strategies in order:
    1. Direct parse (entire string is valid JSON)
    2. ```json code block extraction
    3. ``` code block extraction
    4. Find outermost { ... } or [ ... ] boundaries

    Args:
        raw: Raw LLM response text.

    Returns:
        A string containing valid JSON.

    Raises:
        JudgeResponseError: If no valid JSON can be found.
    """
    if not raw or not raw.strip():
        raise JudgeResponseError("Empty LLM response", raw_response=raw)

    text = raw.strip()

    # Strategy 1: Try direct parse
    try:
        json.loads(text)
        logger.debug("[OUTPUT_PARSE] Parsed raw text directly as JSON")
        return text
    except json.JSONDecodeError:
        pass

    # Strategy 2: Extract from ```json code blocks
    json_block_match = re.search(r"```json\s*\n(.*?)\n```", text, re.DOTALL)
    if json_block_match:
        candidate = json_block_match.group(1).strip()
        try:
            json.loads(candidate)
            logger.debug("[OUTPUT_PARSE] Extracted JSON from ```json code block")
            return candidate
        except json.JSONDecodeError:
            pass

    # Strategy 3: Extract from ``` code blocks
    code_block_match = re.search(r"```\s*\n(.*?)\n```", text, re.DOTALL)
    if code_block_match:
        candidate = code_block_match.group(1).strip()
        try:
            json.loads(candidate)
            logger.debug("[OUTPUT_PARSE] Extracted JSON from ``` code block")
            return candidate
        except json.JSONDecodeError:
            pass

    # Strategy 4: Find outermost { ... } or [ ... ]
    # Try object first
    obj_start = text.find("{")
    obj_end = text.rfind("}")
    if obj_start != -1 and obj_end > obj_start:
        candidate = text[obj_start:obj_end + 1]
        try:
            json.loads(candidate)
            logger.debug("[OUTPUT_PARSE] Extracted JSON from { } boundaries")
            return candidate
        except json.JSONDecodeError:
            pass

    # Try array
    arr_start = text.find("[")
    arr_end = text.rfind("]")
    if arr_start != -1 and arr_end > arr_start:
        candidate = text[arr_start:arr_end + 1]
        try:
            json.loads(candidate)
            logger.debug("[OUTPUT_PARSE] Extracted JSON from [ ] boundaries")
            return candidate
        except json.JSONDecodeError:
            pass

    truncated = text[:200] + "..." if len(text) > 200 else text
    raise JudgeResponseError(
        "Could not extract valid JSON from LLM response",
        raw_response=truncated,
    )


def parse_llm_json(
    raw_text: str,
    schema: type[T],
    *,
    allow_partial: bool = True,
) -> T:
    """Parse raw LLM text into a validated Pydantic model.

    Steps:
    1. Extract JSON string using extract_json_text()
    2. Parse JSON into dict
    3. Validate against Pydantic schema

    Args:
        raw_text: Raw LLM response text.
        schema: Pydantic model class to validate against.
        allow_partial: If True, use defaults for missing fields.
            If False, raise on missing required fields.

    Returns:
        Validated Pydantic model instance.

    Raises:
        JudgeResponseError: If no valid JSON found or schema validation fails.

    Example:
        >>> from app.core.llm_judge.schemas import RetrievalEvalOutput
        >>> result = parse_llm_json('{"context_relevance": 0.8}', RetrievalEvalOutput)
        >>> result.context_relevance
        0.8
    """
    json_text = extract_json_text(raw_text)
    data = json.loads(json_text)

    try:
        validated = schema.model_validate(data)
        # Check for missing fields and log
        if isinstance(data, dict):
            schema_fields = set(schema.model_fields.keys())
            provided_fields = set(data.keys())
            missing = schema_fields - provided_fields
            if missing:
                logger.warning(
                    f"[OUTPUT_PARSE] Missing fields: {sorted(missing)}, "
                    f"used defaults for {schema.__name__}"
                )
            else:
                logger.debug(f"[OUTPUT_PARSE] Validated {schema.__name__} successfully")
        return validated
    except ValidationError as e:
        if not allow_partial:
            truncated = raw_text[:200] + "..." if len(raw_text) > 200 else raw_text
            logger.error(
                f"[OUTPUT_PARSE] Failed to parse {schema.__name__}: {e}. "
                f"Raw: {truncated}"
            )
            raise JudgeResponseError(
                f"Schema validation failed for {schema.__name__}: {e}",
                raw_response=truncated,
            )
        # In allow_partial mode, try with just defaults
        logger.warning(
            f"[OUTPUT_PARSE] Validation error for {schema.__name__}, "
            f"attempting with defaults: {e}"
        )
        try:
            return schema.model_validate({})
        except ValidationError:
            raise JudgeResponseError(
                f"Schema validation failed for {schema.__name__}: {e}",
                raw_response=raw_text[:200],
            )


def parse_llm_json_array(
    raw_text: str,
    item_schema: type[T],
) -> list[T]:
    """Parse raw LLM text as a JSON array of validated items.

    Extracts a JSON array from the text, then validates each element
    against the item schema. Items that fail validation are skipped
    with a warning.

    Args:
        raw_text: Raw LLM response text.
        item_schema: Pydantic model class for each array element.

    Returns:
        List of validated Pydantic model instances.

    Example:
        >>> from app.core.llm_judge.schemas import VerificationItem
        >>> items = parse_llm_json_array('[{"claim_number": 1, "status": "SUPPORTED"}]', VerificationItem)
        >>> len(items)
        1
    """
    json_text = extract_json_text(raw_text)
    data = json.loads(json_text)

    # If data is a dict with a "results" key containing an array, unwrap it
    if isinstance(data, dict) and "results" in data and isinstance(data["results"], list):
        data = data["results"]

    if not isinstance(data, list):
        logger.warning(
            f"[OUTPUT_PARSE] Expected JSON array for {item_schema.__name__}, "
            f"got {type(data).__name__}"
        )
        return []

    validated_items: list[T] = []
    for i, item in enumerate(data):
        try:
            validated_items.append(item_schema.model_validate(item))
        except ValidationError as e:
            logger.warning(
                f"[OUTPUT_PARSE] Skipping invalid item {i} for "
                f"{item_schema.__name__}: {e}"
            )

    logger.debug(
        f"[OUTPUT_PARSE] Parsed {len(validated_items)}/{len(data)} "
        f"{item_schema.__name__} items"
    )
    return validated_items
