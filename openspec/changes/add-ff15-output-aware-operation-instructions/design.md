## Context

The current operation prompt layer parses YAML-backed step metadata and emits XML prompts for Noctis and worker-owned steps, but it treats authored content as static text. That is enough for smoke-test operations, yet real bundled workflows rely on authored placeholders that refer to previous step outputs, named output contracts, workspace-root-relative assets, and extension settings. Without resolution, the XML prompt exposes raw template tokens that the agent cannot use directly.

Canonical mission runtime data already stores workflow progress under `.ff15/missions/<missionId>/mission.json`, and bundled workflow assets already materialize under `.ff15/operations` and `.ff15/facets`. The narrowest integration point is the operation prompt composition layer, because it already loads step metadata and owns the final XML prompt body passed to the mission transport.

## Goals / Non-Goals

**Goals:**
- Resolve authored placeholders before prompt delivery for both initial Noctis sends and worker auto-dispatch prompts.
- Support placeholders for prior outputs, output-contract references, workspace-root and runtime paths, and FF15 extension settings needed by bundled workflows.
- Surface missing references as actionable runtime errors instead of silently emitting raw placeholders.
- Cover successful and failure paths with focused tests using real bundled workflow assets rather than smoke-test-only prompts.

**Non-Goals:**
- Full upstream parity for every possible template token in multi-agent-ff15.
- A generalized templating engine exposed outside operation prompt composition.
- UI changes in the Mission Workbench beyond surfacing existing runtime errors.

## Decisions

### Resolve authored placeholders inside operation prompt composition

Prompt composition will resolve placeholders immediately before XML assembly, using the active mission id, workspace root, workflow state, and operation assets as the resolution context.

- Chosen because the prompt layer already owns step metadata loading and is the last point before agent-facing prompt delivery.
- Alternative considered: pre-resolve and persist fully rendered instructions in mission state. Rejected because resolution depends on the current active step, evolving runtime outputs, and workspace-local artifacts.

### Treat missing references as explicit runtime failures

When a placeholder references a missing output, output contract, asset, or setting, prompt composition will throw an actionable error that names the unresolved reference.

- Chosen because silent fallback would still deliver broken XML prompts and hide why real bundled workflows failed.
- Alternative considered: leave unresolved tokens in place. Rejected because the issue explicitly requires actionable runtime failures instead of raw template tokens.

### Reuse canonical mission state as the source of prior outputs

Resolved prior-output references will be derived from canonical mission runtime state and any workspace-local output artifacts already referenced by that state, rather than inventing a second persistence surface.

- Chosen because `.ff15/missions/<missionId>/mission.json` is already the canonical runtime source for workflow progress and handoff history.
- Alternative considered: scan arbitrary workspace files heuristically. Rejected because it is nondeterministic and not scoped to authored operation contracts.

## Risks / Trade-offs

- [Bundled workflows may use more placeholder variants than this slice supports] -> Start from the variants exercised by the real bundled assets in this repo and fail loudly on unsupported references.
- [Prompt-composition failures may stop mission delivery earlier than before] -> Return explicit runtime errors so the Mission Workbench can already surface the failure through existing error plumbing.
- [Resolution logic could sprawl across multiple prompt builders] -> Keep one shared resolution path used by both Noctis and worker XML prompt builders.

## Migration Plan

No explicit migration is required. Existing missions keep working, and placeholder resolution only activates when authored assets include supported output-aware tokens.

## Open Questions

- None for the first output-aware resolution slice; unsupported placeholder variants should fail explicitly so follow-up issues can add coverage deliberately.