# Ollama Provider Support Implementation Plan

> **Status**: Planning Complete - Ready for Implementation
> **Last Updated**: December 2024
> **Scope**: LLM Judge, Answer Generation, Embeddings (complete)

---

## Overview

Add Ollama as a fully supported provider across three areas:

| Area | Current Status | Work Required |
|------|---------------|---------------|
| **Embeddings** | Complete | None - Factory pattern already supports Ollama |
| **LLM Judge** | Config exists, no implementation | Full implementation needed |
| **Answer Generation (QA Chain)** | Hardcoded to OpenAI | Requires abstraction layer |

---

## Current State Analysis

### Embeddings (Complete)

The `EmbeddingFactory` in `backend/app/core/embedding_factory.py` already supports Ollama:

```python
# Already implemented
EmbeddingFactory.create("ollama", model="nomic-embed-text", base_url="...")
```

**Pattern Quality**: Excellent - Clean factory pattern with provider registry.

### LLM Judge (Partial)

The judge system has:
- `BaseLLMJudge` abstract class in `base.py`
- `OpenAIJudge` and `AnthropicJudge` implementations
- `JudgeFactory` with registry pattern
- Config field `eval_judge_provider` exists but no Ollama implementation

**Pattern Quality**: Excellent - Well-structured for extension.

### Answer Generation (Needs Work)

The QA chain in `backend/app/core/qa_chain.py`:
- Hardcoded to `ChatOpenAI` from LangChain
- No provider abstraction
- No factory pattern

**Pattern Quality**: Poor - Needs refactoring for multi-provider support.

---

## Design Principles

### DRY (Don't Repeat Yourself)

- Reuse `load_prompts()` from `base.py` (already centralized)
- Reuse `_clamp_score()` and `_format_chunks()` from base class
- Share Ollama client configuration across components
- Create shared utilities for common Ollama operations

### Logging Standards

Use module-level logger with appropriate levels:

```python
logger = logging.getLogger(__name__)

# DEBUG: API call details, model selection
logger.debug(f"Calling Ollama with model: {self.model}")

# INFO: Provider creation, successful operations
logger.info(f"OllamaJudge initialized with model: {model}")

# WARNING: Fallback behavior, degraded operation
logger.warning("Ollama server slow, retrying...")

# ERROR: Failed API calls, parsing errors
logger.error(f"Ollama API error: {e}")
```

### Error Handling

Custom exceptions for clear error messages:

| Exception | When to Raise |
|-----------|---------------|
| `OllamaUnavailableError` | Server not reachable |
| `OllamaModelNotFoundError` | Model not pulled/available |
| `JudgeResponseError` | Invalid response format |

Graceful degradation with actionable messages:

```python
if not self.is_available():
    raise OllamaUnavailableError(
        "Ollama server not reachable at http://localhost:11434. "
        "Please ensure Ollama is running: `ollama serve`"
    )
```

### Configuration Strategy

| Config Type | Location | Examples |
|-------------|----------|----------|
| Infrastructure | `.env` | `OLLAMA_BASE_URL` (server address) |
| User Choices | DB Settings | `answer_provider`, `eval_judge_provider`, model names |

**Note**: Ollama requires no API key (local service).

---

## Implementation TODO List

### Phase 1: Ollama Judge Implementation

#### 1.1 Create OllamaJudge Class

**File**: `backend/app/core/llm_judge/ollama_judge.py`

- [ ] Create `OllamaJudge(BaseLLMJudge)` class
- [ ] Implement async client using `httpx` or `ollama` package
- [ ] Implement `is_available()` with health check
- [ ] Implement `_call_llm()` for API communication
- [ ] Implement `evaluate_retrieval()` method
- [ ] Implement `evaluate_answer()` method
- [ ] Implement `_evaluate_ground_truth()` method
- [ ] Add robust JSON extraction (similar to Anthropic judge pattern)
- [ ] Use shared prompts from `load_prompts()`

**Class Structure**:

```python
class OllamaJudge(BaseLLMJudge):
    """Ollama-based LLM judge for local evaluation."""

    DEFAULT_MODEL = "mistral"  # Good balance of speed/quality

    def __init__(
        self,
        model: str | None = None,
        timeout: int | None = None,
        max_retries: int | None = None,
    ):
        """Initialize Ollama judge."""
        settings = get_settings()
        super().__init__(
            model=model or self.DEFAULT_MODEL,
            timeout=timeout or settings.eval_timeout_seconds,
            max_retries=max_retries or settings.eval_retry_count,
        )
        self._base_url = settings.ollama_base_url
        self._prompts = load_prompts()

    @property
    def provider_name(self) -> str:
        return "ollama"

    def is_available(self) -> bool:
        """Check if Ollama server is reachable and model exists."""
        # 1. Check server connectivity
        # 2. Check if model is available
        ...

    async def _call_llm(self, system_prompt: str, user_prompt: str) -> dict:
        """Make Ollama API call and parse JSON response."""
        # POST to /api/chat
        # Extract JSON from response
        ...
```

#### 1.2 Register in Factory

**File**: `backend/app/core/llm_judge/factory.py`

- [ ] Import `OllamaJudge`
- [ ] Register: `JudgeFactory.register("ollama", OllamaJudge)`

#### 1.3 Update Exports

**File**: `backend/app/core/llm_judge/__init__.py`

- [ ] Add `OllamaJudge` to exports

#### 1.4 Add Configuration

**File**: `backend/app/db/models.py`

- [ ] Add `eval_judge_model` field to Settings model
- [ ] Default: `"mistral"` for Ollama, current model for others

---

### Phase 2: Answer Provider Abstraction

#### 2.1 Create LLM Factory

**File**: `backend/app/core/llm_factory.py` (NEW)

- [ ] Create `LLMFactory` class with registry pattern
- [ ] Support providers: `openai`, `anthropic`, `ollama`
- [ ] Parse model string format: `"provider:model"` or just `"model"`
- [ ] Return appropriate LangChain chat model

**Class Structure**:

```python
class LLMFactory:
    """Factory for creating LLM instances for answer generation."""

    PROVIDERS = {
        "openai": {
            "class": ChatOpenAI,
            "models": ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"],
        },
        "anthropic": {
            "class": ChatAnthropic,
            "models": ["claude-sonnet-4-5-20250929", "claude-3-5-haiku-latest"],
        },
        "ollama": {
            "class": ChatOllama,
            "models": ["mistral", "llama3", "dolphin-mixtral"],
        },
    }

    @classmethod
    def create(
        cls,
        provider: str,
        model: str,
        temperature: float = 0.0,
        **kwargs
    ) -> BaseChatModel:
        """Create LLM instance for the specified provider."""
        ...

    @classmethod
    def get_available_providers(cls) -> list[str]:
        """Return list of providers with valid configuration."""
        ...
```

#### 2.2 Create Provider Implementations

- [ ] `_create_openai()` - Use `ChatOpenAI`
- [ ] `_create_anthropic()` - Use `ChatAnthropic`
- [ ] `_create_ollama()` - Use `ChatOllama`
- [ ] Shared interface: streaming support, temperature, timeout

#### 2.3 Refactor QA Chain

**File**: `backend/app/core/qa_chain.py`

- [ ] Remove hardcoded `ChatOpenAI` import
- [ ] Use `LLMFactory.create(provider, model)`
- [ ] Add `provider` parameter to `__init__`
- [ ] Update answer generation to use factory

**Before**:
```python
from langchain_openai import ChatOpenAI

class QAChain:
    def __init__(self):
        self.llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
```

**After**:
```python
from app.core.llm_factory import LLMFactory

class QAChain:
    def __init__(self, provider: str = "openai", model: str | None = None):
        settings = get_settings()
        self.llm = LLMFactory.create(
            provider=provider or settings.answer_provider,
            model=model or settings.answer_model,
        )
```

#### 2.4 Add DB Settings Fields

**File**: `backend/app/db/models.py`

- [ ] Add `answer_provider` field (default: `"openai"`)
- [ ] Add `answer_model` field (default: `"gpt-4o-mini"`)

**File**: `backend/app/api/schemas/settings.py`

- [ ] Update `SettingsResponse` schema
- [ ] Update `SettingsUpdate` schema

---

### Phase 3: Frontend Updates

#### 3.1 Update Settings Types

**File**: `frontend/src/lib/api/settings.ts`

- [ ] Add `answer_provider` to `Settings` interface
- [ ] Add `answer_model` to `Settings` interface
- [ ] Add `eval_judge_model` to `Settings` interface

#### 3.2 Update Settings Page

**File**: `frontend/src/app/settings/page.tsx`

- [ ] Add Answer Provider dropdown (openai, anthropic, ollama)
- [ ] Add Answer Model dropdown (dependent on selected provider)
- [ ] Add Eval Judge Model dropdown (dependent on selected provider)
- [ ] Show Ollama availability status indicator
- [ ] Add model refresh button for Ollama

#### 3.3 Add Ollama Models Configuration

Define available models per task:

| Task | Recommended Models | Notes |
|------|-------------------|-------|
| **Evaluation** | mistral, llama3, neural-chat | Need good reasoning |
| **Answer Generation** | mistral, llama3, dolphin-mixtral | Need coherent responses |
| **Fast/Testing** | phi, tinyllama | For development |

---

### Phase 4: Testing & Documentation

#### 4.1 Health Check Endpoint

**File**: `backend/app/api/v1/health.py` (or similar)

- [ ] Add `/api/v1/health/ollama` endpoint
- [ ] Check server connectivity
- [ ] List available models
- [ ] Return status and model list

#### 4.2 Documentation

- [ ] Create `docs/OLLAMA_SETUP.md` with:
  - Installation instructions
  - Recommended models by task
  - Troubleshooting guide
  - Performance considerations

---

## File Changes Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `backend/app/core/llm_judge/ollama_judge.py` | Ollama judge implementation |
| `backend/app/core/llm_factory.py` | LLM provider factory for QA chain |
| `docs/OLLAMA_SETUP.md` | Setup and configuration guide |

### Files to Modify

| File | Changes |
|------|---------|
| `backend/app/core/llm_judge/factory.py` | Register OllamaJudge |
| `backend/app/core/llm_judge/__init__.py` | Export OllamaJudge |
| `backend/app/core/qa_chain.py` | Use LLMFactory instead of hardcoded OpenAI |
| `backend/app/db/models.py` | Add answer_provider, answer_model, eval_judge_model |
| `backend/app/api/schemas/settings.py` | Update settings schemas |
| `backend/app/config.py` | Add Ollama model defaults |
| `frontend/src/app/settings/page.tsx` | Add provider/model dropdowns |
| `frontend/src/lib/api/settings.ts` | Update types |

---

## Success Criteria

### Functional Requirements

- [ ] Ollama appears in Eval Judge provider dropdown
- [ ] Ollama appears in Answer provider dropdown
- [ ] Evaluations run successfully with Ollama judge
- [ ] AI answers generate successfully with Ollama
- [ ] Health check shows Ollama status
- [ ] Graceful error when Ollama unavailable

### Non-Functional Requirements

- [ ] No code duplication between judge implementations
- [ ] Consistent logging across all Ollama operations
- [ ] Clear error messages for common failures:
  - Server not running
  - Model not pulled
  - Connection timeout
- [ ] Configuration follows established patterns
- [ ] All new code has docstrings

### Testing Checklist

- [ ] Unit: OllamaJudge methods
- [ ] Unit: LLMFactory provider creation
- [ ] Integration: Full evaluation with Ollama
- [ ] Integration: Answer generation with Ollama
- [ ] Error: Ollama server down
- [ ] Error: Model not available

---

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| `ollama_judge.py` | Full judge implementation following existing patterns |
| `llm_factory.py` | LLM abstraction layer for answer generation |
| Updated `qa_chain.py` | Refactored to use factory pattern |
| Updated Settings model | New fields for provider/model selection |
| Updated Frontend | Settings page with provider dropdowns |
| `OLLAMA_SETUP.md` | User-facing setup documentation |

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Ollama server not running | High | Health check + clear error message |
| Model not pulled | Medium | List available models, show pull command |
| Slow response times | Medium | Timeout configuration, async operations |
| JSON parsing failures | Medium | Robust extraction (like Anthropic judge) |
| Breaking existing OpenAI flow | High | Feature flag, test thoroughly |

---

## Dependencies

### Python Packages

```
ollama>=0.1.0        # Official Ollama Python client
langchain-ollama     # LangChain Ollama integration (for QA)
httpx                # Async HTTP client (likely already present)
```

### External Requirements

- Ollama server running locally (user responsibility)
- At least one model pulled: `ollama pull mistral`

---

## Appendix: Ollama Model Recommendations

### For Evaluation (LLM Judge)

| Model | Size | Speed | Quality | Notes |
|-------|------|-------|---------|-------|
| mistral | 7B | Fast | Good | Recommended default |
| llama3 | 8B | Medium | Better | Good reasoning |
| neural-chat | 7B | Fast | Good | Intel optimized |

### For Answer Generation

| Model | Size | Speed | Quality | Notes |
|-------|------|-------|---------|-------|
| mistral | 7B | Fast | Good | General purpose |
| dolphin-mixtral | 47B | Slow | Excellent | Best quality, needs RAM |
| llama3 | 8B | Medium | Better | Good balance |

### For Development/Testing

| Model | Size | Speed | Notes |
|-------|------|-------|-------|
| phi | 2.7B | Very Fast | Quick iteration |
| tinyllama | 1.1B | Very Fast | Minimal resources |

---

*Document created: December 2024*
*Based on codebase analysis of semantic-search-next*
