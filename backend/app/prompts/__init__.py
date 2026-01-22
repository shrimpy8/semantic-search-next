"""
Prompt Management Module

Loads and manages LLM prompts from external YAML files.
This allows prompts to be edited without modifying code.

Usage:
    from app.prompts import prompts

    # Get a specific prompt
    system_prompt = prompts.get("qa", "qa_system")

    # Get with variable substitution
    prompt = prompts.get("verification", "claim_extraction_user", answer="...")
"""

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml  # type: ignore[import-untyped]

logger = logging.getLogger(__name__)

# Directory containing prompt YAML files
PROMPTS_DIR = Path(__file__).parent


class PromptManager:
    """
    Manages loading and accessing prompts from YAML files.

    Prompts are organized by category (file name) and key (YAML key).
    Supports variable substitution using str.format().
    """

    def __init__(self, prompts_dir: Path = PROMPTS_DIR):
        """
        Initialize the prompt manager.

        Args:
            prompts_dir: Directory containing prompt YAML files
        """
        self.prompts_dir = prompts_dir
        self._cache: dict[str, dict[str, str]] = {}
        self._load_all_prompts()

    def _load_all_prompts(self) -> None:
        """Load all YAML prompt files from the prompts directory."""
        for yaml_file in self.prompts_dir.glob("*.yaml"):
            category = yaml_file.stem  # filename without extension
            try:
                with open(yaml_file, encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                    if isinstance(data, dict):
                        self._cache[category] = data
                        logger.info(f"Loaded {len(data)} prompts from {yaml_file.name}")
                    else:
                        logger.warning(f"Invalid prompt file format: {yaml_file.name}")
            except Exception as e:
                logger.error(f"Failed to load prompts from {yaml_file.name}: {e}")

    def reload(self) -> None:
        """Reload all prompts from disk. Useful for development."""
        self._cache.clear()
        self._load_all_prompts()
        logger.info("Prompts reloaded from disk")

    def get(self, category: str, key: str, **kwargs: Any) -> str:
        """
        Get a prompt by category and key.

        Args:
            category: The prompt category (YAML filename without extension)
            key: The prompt key within the YAML file
            **kwargs: Variables to substitute into the prompt

        Returns:
            The prompt string with variables substituted

        Raises:
            KeyError: If category or key not found

        Example:
            >>> prompts.get("qa", "qa_system", question="What is AI?", document="...")
        """
        if category not in self._cache:
            raise KeyError(f"Prompt category '{category}' not found. Available: {list(self._cache.keys())}")

        if key not in self._cache[category]:
            raise KeyError(f"Prompt key '{key}' not found in '{category}'. Available: {list(self._cache[category].keys())}")

        prompt = self._cache[category][key]

        # Substitute variables if provided
        if kwargs:
            try:
                prompt = prompt.format(**kwargs)
            except KeyError as e:
                logger.warning(f"Missing variable in prompt {category}.{key}: {e}")
                # Return unformatted prompt if variables missing
                pass

        return prompt

    def get_raw(self, category: str, key: str) -> str:
        """
        Get a prompt without variable substitution.

        Args:
            category: The prompt category
            key: The prompt key

        Returns:
            The raw prompt template string
        """
        if category not in self._cache:
            raise KeyError(f"Prompt category '{category}' not found")
        if key not in self._cache[category]:
            raise KeyError(f"Prompt key '{key}' not found in '{category}'")
        return self._cache[category][key]

    def list_categories(self) -> list[str]:
        """List all available prompt categories."""
        return list(self._cache.keys())

    def list_prompts(self, category: str) -> list[str]:
        """List all prompt keys in a category."""
        if category not in self._cache:
            raise KeyError(f"Prompt category '{category}' not found")
        return list(self._cache[category].keys())

    def __contains__(self, category: str) -> bool:
        """Check if a category exists."""
        return category in self._cache


@lru_cache(maxsize=1)
def get_prompt_manager() -> PromptManager:
    """Get the singleton prompt manager instance."""
    return PromptManager()


# Convenience alias for quick access
prompts = get_prompt_manager()
