## Context

The extension currently resolves one workspace root and reuses it across launch, mission context, and operation-aware prompt placeholders. Users cannot inspect harness source selection rules from the extension UI, and startup behavior is opaque when both `.agents` and `.ff15` are possible.

Issue #45 adds a deterministic resolver and a read-only Projects sidebar to make configuration source and openspec state visible before editable configuration work in follow-up issues.

## Goals / Non-Goals

**Goals:**
- Introduce one resolver module that determines harness root with strict precedence: `.agents/harness` -> `.ff15/harness` -> bootstrap `.ff15/harness`.
- Enforce strict behavior when `.agents/harness` exists but is invalid: surface error and stop fallback.
- Expose resolved source path, active projects, and openspec mode/path in a new FF15 Projects sidebar view.
- Keep behavior backward compatible for existing valid `.agents/harness` users.

**Non-Goals:**
- Editable Projects configuration UX (handled in a later issue).
- Launch/missions prompt contract rewiring (handled in a later issue).
- agent-harness schema relaxation (`openspec.project_id` decoupling) in this slice.

## Decisions

1. Add a dedicated resolver service in extension host code.
   - Why: centralizes precedence + bootstrap + validation behavior and avoids duplicating file-system decisions in views/controllers.
   - Alternative considered: inline resolver logic in Projects provider only. Rejected because other features need the same state in later slices.

2. Bootstrap only under `.ff15/harness` and never under `.agents/harness`.
   - Why: `.agents` is user-managed authoritative config when present; silent regeneration there is risky.
   - Alternative considered: bootstrap whichever path is first in precedence. Rejected due accidental overwrite risk.

3. Represent invalid `.agents/harness` as explicit resolver error state displayed in Projects view.
   - Why: acceptance criteria explicitly forbids fallback and requires visibility.
   - Alternative considered: warning + fallback to `.ff15`. Rejected by requirement.

4. Implement Projects sidebar using existing FF15 webview/provider pattern.
   - Why: keeps extension architecture consistent and allows incremental expansion to editable state later.
   - Alternative considered: native tree view. Rejected to keep UI language aligned with existing Launch/Missions/Settings surfaces.

## Risks / Trade-offs

- [Risk] Bootstrap file content drifts from agent-harness expectations.
  → Mitigation: derive minimum v2-compatible template from existing `.agents/harness/config/agent-harness.yaml` shape and keep tests on required keys.

- [Risk] Resolver runs before workspace state is stable in multi-root windows.
  → Mitigation: use the same first-workspace-folder selection rule already used in extension activation.

- [Risk] Users may misread read-only surface as editable.
  → Mitigation: clearly label values as read-only and expose source path + status.

## Migration Plan

1. Add resolver service and unit tests.
2. Add Projects view registration and provider payload wiring.
3. Add webview route/component to render resolved state.
4. Validate startup behavior across `.agents` valid, `.agents` invalid, `.ff15` only, and empty workspace cases.

Rollback: remove Projects view registration and revert resolver call sites; existing workspace-root behavior remains available in main.

## Open Questions

- Should bootstrap `default.yaml` include one placeholder repo entry or a concrete repo inferred from the current workspace? This slice uses a minimal deterministic placeholder to avoid accidental coupling.