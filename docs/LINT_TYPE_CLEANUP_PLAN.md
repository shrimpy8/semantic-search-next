# Lint/Type Cleanup Plan (Low Risk)

Goal: Reduce lint/type errors without changing runtime behavior. This work should be isolated, incremental, and reversible.

## Guiding Principles
- **No behavior changes**: focus on types, annotations, imports, and refactoring that does not alter logic.
- **Small batches**: fix files in small groups to keep diffs readable and reduce risk.
- **Active-code first**: prioritize modules used by FastAPI app; defer legacy modules unless needed to satisfy tooling.
- **No mass auto-fixes** across the repo in one shot.

## Current State (Known)
- `ruff` and `mypy` currently report many issues across the codebase, including legacy modules.
- Legacy modules are not used by the current app; fixing them can be optional or deferred.
- Local git commits are blocked because `.git` is not writable (cannot create `.git/index.lock`); requires OS permission fix or moving the repo.

## Strategy Overview

### Phase 1 — Scope & Baseline
1) **Define active scope**: only files imported by FastAPI app (`backend/app/api`, `backend/app/services`, `backend/app/core` used by routes, and `backend/app/db`).
2) **Record baseline**: run `ruff check` and `mypy` on active scope only. Capture counts.
3) **Exclude legacy**: ensure we do not “fix” unused legacy modules unless necessary to satisfy tooling.

### Phase 2 — Lint Cleanup (Low Risk)
1) **Imports and formatting**: fix `F401`, `I001` in active scope using `ruff --fix` on small file sets.
2) **No logic changes**: avoid refactoring methods beyond formatting and type hints.

### Phase 3 — Type Hints (Low Risk)
1) **Add missing annotations** (`no-untyped-def`) with safe defaults.
2) **Fix obvious type mismatches** using local casts or `typing` helpers.
3) **Avoid signature changes** that alter external behavior.

### Phase 4 — Validation
1) Re-run targeted `ruff` and `mypy` on active scope.
2) Run a minimal smoke test (health endpoint, search endpoint) to confirm no runtime regression.

## Proposed File Batches (Active Scope)

Batch A — API surface
- `backend/app/api/*.py`
- `backend/app/api/v1/*.py`

Batch B — Services + DB
- `backend/app/services/*.py`
- `backend/app/db/**/*.py`

Batch C — Core runtime dependencies
- `backend/app/core/vector_store.py`
- `backend/app/core/hybrid_retriever.py`
- `backend/app/core/bm25_retriever.py`
- `backend/app/core/reranker.py`
- `backend/app/core/qa_chain.py`
- `backend/app/core/answer_verifier.py`
- `backend/app/core/llm_factory.py`
- `backend/app/core/embeddings.py`

## Risk Control
- Each batch produces a separate commit.
- If any behavioral risk is suspected, stop and request confirmation.
- Maintain a rollback point per batch.

## What We Will Not Do
- No changes to business logic.
- No large refactors or algorithm changes.
- No migration changes.
