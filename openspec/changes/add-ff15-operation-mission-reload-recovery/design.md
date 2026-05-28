## Context

The extension already persists operation-backed mission state under `.ff15/missions/<missionId>/mission.json`, including `operationRef`, workflow state, probe metadata, session metadata, and agent panes. The Mission Workbench reads hydrated mission state from the missions store, but the runtime probe service currently treats `workflow.runtimeStatus === "ready"` as a reason to skip bootstrap entirely. That works during a single extension lifetime, but fails after VS Code reload because the in-memory loopback server and bridge manifest are gone even though the hydrated mission still says `ready`.

Issue #26 needs recovery behavior at the existing public surfaces: mission hydration from `.ff15`, Mission Workbench reopen, and runtime bridge availability. The smallest useful slice is to make runtime probe bootstrap distinguish between "ready in memory" and "ready on disk but runtime missing", then verify the Workbench path rehydrates enough context to continue without recreating the mission.

## Goals / Non-Goals

**Goals:**
- Recover operation-backed mission runtime state from canonical `.ff15` data after extension reload.
- Rebuild runtime bridge assets when a hydrated mission is reopened and the in-memory bridge no longer exists.
- Keep the existing Mission Workbench surface and mission identity intact across reload and re-selection.
- Cover the recovery path with focused runtime-probe and workbench tests.

**Non-Goals:**
- Replacing the current loopback runtime bridge design.
- Reconstructing worker pane contents or agent chat history beyond existing mission/session metadata.
- Expanding mission recovery into a broader synchronization framework outside `.ff15`.

## Decisions

### Distinguish hydrated readiness from live runtime availability

The runtime probe service will continue to trust canonical mission workflow data, but it will not treat `runtimeStatus: ready` alone as proof that the loopback runtime is still alive. Instead, reload recovery will re-bootstrap when the workspace runtime or bridge assets are missing from the current extension process.

- Chosen because the existing early return in `ensureMissionRuntime` is the direct blocker after reload.
- Alternative considered: clearing `runtimeStatus` during hydration. Rejected because canonical mission state should remain descriptive, not be mutated just to force bootstrap.

### Recover through the Mission Workbench reopen path

Mission recovery will remain driven by the existing `showMission` and `ff15-mission-workbench.ready` flow. Reopening the Workbench for a hydrated mission will post the saved mission state, ensure the runtime bridge is available again, and then publish the refreshed state.

- Chosen because issue #26 is explicitly about reload and re-selection without adding a new public command surface.
- Alternative considered: auto-probing every hydrated mission during extension activation. Rejected because it would eagerly spin up loopback runtime state for missions the user may never reopen.

### Preserve workflow identity instead of resetting to probe placeholders

Recovery will preserve the selected operation and saved active workflow step/task from canonical mission state. Probe readiness may still be refreshed, but it must not erase the existing operation step identity needed to continue the mission.

- Chosen because users need to reopen the Workbench and continue where they left off.
- Alternative considered: resetting recovered missions back to the operation initial step. Rejected because it would violate the issue acceptance criteria.

## Risks / Trade-offs

- [Recovered runtime state may look ready even when loopback assets are stale] -> Re-bootstrap when the current extension process lacks a live workspace runtime or bridge manifest.
- [Refreshing readiness could accidentally overwrite active workflow step context] -> Keep bridge self-check metadata separate from the saved operation step/task identity during recovery.
- [Workbench reopen could double-post transient states] -> Reuse the existing post-before/after-probe pattern and cover it with focused tests.

## Migration Plan

No migration is required. Existing `.ff15` mission records remain the source of truth, and recovered missions simply regain runtime availability when reopened.

## Open Questions

- None for the first reload-recovery slice.