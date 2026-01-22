# Milestones — Unused Modules & DRY Cleanup (Low Risk)

Status key: [ ] pending, [~] in progress, [x] completed

## Phase A — Inventory & Safety Gates
- [ ] Confirm unused modules by reference scan and runtime usage
- [ ] Define safe cleanup scope (docs, comments, exports)
- [ ] Identify DRY improvements tied to unused modules

## Phase B — Low-Risk Cleanup
- [x] Remove unused re-exports from `backend/app/core/__init__.py`
- [x] Add deprecation notes to legacy modules (no behavior change)
- [x] Update docs to clarify legacy modules are unused

## Phase C — Optional Removal (Only if Approved)
- [ ] Remove legacy JSON-storage modules entirely
- [ ] Remove unused prompts or assets tied only to legacy modules

## Phase D — Lint/Type Refactor (Separate Branch)
- [ ] Create `cleanup/lint-type` branch
- [ ] Scope lint/type fixes to active code only
- [ ] Apply fixes in isolated PR
