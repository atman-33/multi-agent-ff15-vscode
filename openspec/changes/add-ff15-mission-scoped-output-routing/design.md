## Context

Issue #36 added output-aware placeholder resolution, but the current extension still anchors output contracts and prior-output lookups at the workspace root. The canonical mission runtime already lives under `.ff15/missions/<missionId>/`, so the smallest correct fix is to route both output-path guidance and `output(...)` placeholder resolution through a shared mission-scoped path helper instead of `join(workspaceRoot, fileName)`.

The affected behavior is shared by Noctis activation prompts and worker-owned follow-up prompts. Both prompt builders already converge in the operation definition layer, which makes that layer the right place to centralize mission-scoped output routing.

## Goals / Non-Goals

**Goals:**
- Route declared step outputs into a deterministic mission-scoped runtime path.
- Reuse the same mission-scoped path helper for output-contract guidance and `output(...)` placeholder resolution.
- Keep Noctis and worker prompt behavior aligned through one shared resolution path.
- Cover the change with focused prompt-composition tests and repository validation.

**Non-Goals:**
- Legacy workspace-root fallback for already-running missions. That is issue #40.
- Retry-attempt-specific output directories that preserve multiple attempts for the same step. That is issue #41.
- Broader upstream output metadata parity beyond the path-routing contract needed for this slice.

## Decisions

### Add a shared mission output path helper

Mission-scoped output routing will use a dedicated helper rooted in the canonical mission runtime tree, with paths shaped as `.ff15/missions/<missionId>/outputs/<stepId>/<taskId>/<fileName>`.

- Chosen because the upstream project already uses the same step/task/file hierarchy and the extension already owns the mission runtime root.
- Alternative considered: store output artifacts directly beside `mission.json` or under a flat `outputs/<fileName>` directory. Rejected because it loses step/task provenance and does not match the upstream runtime contract.

### Resolve both current-step guidance and prior-step placeholders from the same helper

Output-contract sections will emit an explicit mission-scoped file path for the current step, and `output(...)` placeholder resolution will look up prior artifacts through the same helper.

- Chosen because the current bug comes from these two paths diverging: prompt guidance is underspecified and prior-output resolution assumes the workspace root.
- Alternative considered: fix only the guidance text and keep placeholder resolution separate. Rejected because prompts would still fail when later steps refer to prior outputs.

### Keep migration and retry semantics out of this slice

If a mission-scoped output does not exist, the extension will fail the same way it does for other missing output references instead of silently falling back to workspace-root artifacts or inventing attempt directories.

- Chosen because #39 is the core routing fix, while #40 and #41 already track the broader compatibility and retry concerns.
- Alternative considered: bundle fallback and retry-directory support into this issue. Rejected because it widens the slice and makes prompt-routing validation harder to isolate.

## Risks / Trade-offs

- [Existing in-flight missions may still have root-level artifacts] -> Leave fallback to issue #40 and keep this slice explicit about requiring mission-scoped outputs.
- [Path-shape mismatches could break worker prompt resolution] -> Drive the helper through focused tests that exercise both Noctis and worker-owned steps.
- [Manual validation may still miss stray workspace-root files] -> Add assertions that generated prompt paths target `.ff15/missions/<missionId>/outputs/...` rather than bare filenames.

## Migration Plan

No data migration is included in this slice. Newly composed prompts will target mission-scoped output paths immediately after deployment, and older root-level artifacts remain unsupported unless issue #40 is implemented later.

## Open Questions

- None for this slice. The main follow-up questions are already split into #40 and #41.