## Context

Issue #59 made OpenCode roster model changes available through the shared mission provider adapter, but the catalog that feeds those controls is still a compile-time constant. That breaks the provider contract in practice: the Mission Workbench cannot tell which models the local OpenCode runtime actually supports for the current workspace, and failures during catalog discovery currently collapse into generic static fallback behavior instead of a visible degraded state.

The sibling `multi-agent-ff15` repository already contains a useful reference for parsing and caching `opencode models --verbose` output. This repo only needs the smaller VS Code extension-host slice: discover the catalog in the target workspace, cache the latest usable snapshot for that workspace, and let Mission Workbench disable model controls without taking down Continue.

## Goals / Non-Goals

**Goals:**
- Discover the OpenCode model catalog from `opencode models --verbose` for a workspace and cache the latest snapshot.
- Project OpenCode roster model pickers from the discovered catalog instead of the hard-coded list.
- Surface a visible model-control-only disabled reason when refresh fails, while keeping Continue enabled.
- Keep GitHub Copilot behavior and provider-owned persistence behavior unchanged.

**Non-Goals:**
- Add a new standalone settings page or catalog browser for OpenCode models.
- Redesign OpenCode provider-owned mission state to persist per-agent model selections.
- Change the existing Continue command flow or broader mission terminal lifecycle.

## Decisions

### Introduce a workspace-scoped OpenCode model catalog service in the extension host
Use a dedicated extension-host service to run `opencode models --verbose`, parse the result, cache the latest snapshot keyed by workspace root, and return both catalog data and refresh status. Mission controllers can then consume one shared abstraction instead of duplicating process execution or cache state.

Alternative considered: keep the static catalog and only add a manual refresh command. Rejected because it does not satisfy the issue acceptance criteria and still misrepresents the locally available OpenCode models.

### Keep provider-specific catalog interpretation in the mission provider adapter boundary
The OpenCode adapter should continue owning how catalog data maps into roster controls and capability flags. The catalog service provides raw discovered data plus refresh status, and the adapter turns that into provider-appropriate picker entries and degraded-action availability.

Alternative considered: let the workbench controller interpret raw CLI output directly. Rejected because it would move provider logic back out of the adapter path introduced in issue #58.

### Model refresh failure as a degraded roster-control state, not a mission-wide failure
When catalog refresh fails, Continue remains available and the last successful catalog stays usable if one exists. If no usable catalog is available, Mission Workbench should disable only the model-change controls and show a reason near the roster controls instead of collapsing the entire workbench into a generic error state.

Alternative considered: set `mission.lastError` and disable the whole roster. Rejected because the issue explicitly requires Continue to remain available and the failure affects only model catalog refresh.

## Risks / Trade-offs

- [Verbose output format drifts from the reference parser] -> Keep parsing logic isolated in one service with focused tests around the expected CLI shape.
- [Workspace caching goes stale] -> Cache the last successful snapshot per workspace and refresh on workbench state loads; preserve stale-but-usable data instead of forcing empty controls.
- [UI disables too much on refresh failure] -> Carry a dedicated model-control disabled reason in workbench state so Continue gating stays separate from model gating.