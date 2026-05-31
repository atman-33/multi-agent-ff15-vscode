## Context

Issue #45 introduced Projects context resolution and read-only visualization, but schema-version handling and openspec source metadata are still minimal. Issue #46 requires explicit handling for v2/v3 compatibility and clearer exposure of source project identity when openspec mode is `project`.

The extension resolver is the local source of truth for this repository; it loads harness session config and project profiles directly from workspace files.

## Goals / Non-Goals

**Goals:**
- Preserve `agent-harness.yaml` version metadata during read without rejecting future version values.
- Keep `openspec.project_id` independent from `active_projects` while preserving strict missing-profile errors.
- Expose openspec source project metadata in resolver snapshots for `project` mode.
- Keep `harness` mode rooted to the owner workspace of the resolved harness config.
- Move bootstrap output to version 3 format.

**Non-Goals:**
- Editing or writing arbitrary session config updates from the Projects UI (handled by a later issue).
- Implementing agent-harness repository hook scripts directly in this change.

## Decisions

1. Extend resolver snapshot contract with `openspec.sourceProjectId` and `configVersion`.
   - Why: issue #46 requires explicit source metadata and version-aware behavior visibility.
   - Alternative considered: infer source metadata only in UI and keep resolver unchanged. Rejected because provider/tests need stable typed payloads.

2. Preserve config version as raw metadata instead of validating against a fixed allowlist.
   - Why: avoids repeated code churn when schema versions change while still exposing version information to the UI.
   - Alternative considered: validate strictly to `{2,3}`. Rejected because future schema changes would require avoidable code edits.

3. Keep strict `openspec.project_id` profile existence checks regardless of `active_projects` membership.
   - Why: decouples configuration concepts while preserving deterministic failure on missing profile.
   - Alternative considered: optional fallback to first active project. Rejected because it hides configuration errors.

4. Bootstrap `.ff15/harness/config/agent-harness.yaml` with `version: 3`.
   - Why: write path should align with new schema target while read path remains backward compatible.
   - Alternative considered: keep writing v2 until external migration. Rejected because it defers contract convergence.

## Risks / Trade-offs

- [Risk] Existing tests and UI types break due snapshot shape expansion.
  → Mitigation: update resolver/provider/webview contracts in one slice and run full `npm run test`.

- [Risk] Future schema drift may no longer be blocked by version validation.
   → Mitigation: keep bootstrap baseline explicit and rely on structural field validation instead of numeric gating.

## Migration Plan

1. Extend resolver types + tests for flexible version/source metadata.
2. Implement version parsing and source project id emission in resolver logic.
3. Update Projects provider/webview typing and rendering.
4. Run lint/test/compile checks.

Rollback: revert resolver snapshot/type changes.

## Open Questions

- No open technical questions for this repository slice.