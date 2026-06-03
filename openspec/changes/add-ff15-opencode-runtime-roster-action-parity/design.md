## Context

Issue #58 introduced a mission provider adapter registry so Mission Workbench and runtime controllers no longer branch directly on provider ids for the touched flows. Issue #59 builds on that boundary: OpenCode still reports no selectable mission model catalog and `agent-actions.ts` currently treats that as meaning in-session model changes are unavailable, even though the Mission Workbench needs provider-specific live-pane commands rather than catalog parity.

The repo already stores provider-owned model state under `providerState`, and OpenCode missions intentionally keep that shape distinct from GitHub Copilot missions. The goal here is roster action parity, not a broader normalization of provider-managed model metadata.

## Goals / Non-Goals

**Goals:**
- Support Continue roster actions for OpenCode missions against a live pane through the mission provider adapter.
- Support immediate OpenCode in-session model changes from the roster with provider-appropriate command sequences.
- Keep GitHub Copilot roster actions and persistence behavior unchanged while validating both providers through the shared adapter path.

**Non-Goals:**
- Introduce a new provider picker or change the fixed four-agent roster.
- Redesign OpenCode provider state to persist per-agent model selections.
- Expand Mission Workbench into a full provider-specific model management UI beyond the existing roster controls.

## Decisions

### Let the adapter own roster-action command behavior instead of inferring support from catalog parity
Keep `agent-actions.ts` provider-agnostic by resolving command sequences and support from the mission provider adapter. OpenCode can therefore support roster actions even when it does not expose the same selectable catalog semantics as GitHub Copilot.

Alternative considered: continue using `getModelCatalog().length === 0` as the model-switching gate and add controller exceptions for OpenCode. Rejected because it reintroduces controller-owned provider branching and couples action support to a catalog shape that OpenCode does not need.

### Use the shared OpenCode model master data for command validation while keeping provider-owned persistence behavior
OpenCode roster actions still need a valid model id and optional effort value to build the live-pane command sequence. Reuse the existing shared model definitions for validation and command construction, but keep provider-specific persistence through the adapter so GitHub Copilot can persist selections while OpenCode remains provider-managed.

Alternative considered: add a new OpenCode-only model catalog and persistence schema first. Rejected because issue #59 only needs parity for immediate roster actions, not a schema expansion.

### Remove workbench-side catalog gating for provider-supported model actions
Mission Workbench should forward roster model-change messages whenever the pinned provider supports that action. The action controller remains the validation boundary for model id, effort, pane resolution, and persistence.

Alternative considered: leave the workbench gate in place and fake a non-empty OpenCode catalog. Rejected because it keeps the wrong responsibility in the workbench and duplicates provider behavior assumptions.

## Risks / Trade-offs

- [OpenCode command grammar diverges from the current `/model` flow] -> Keep provider-specific command sequencing inside the adapter so a future grammar fix stays local to one adapter implementation.
- [Workbenches forward invalid model changes more often] -> Preserve validation in `agent-actions.ts` for model existence, effort compatibility, and live pane resolution.
- [Provider parity is mistaken for full schema parity] -> Keep OpenCode persistence provider-owned and document that this slice only adds live-pane roster action parity.