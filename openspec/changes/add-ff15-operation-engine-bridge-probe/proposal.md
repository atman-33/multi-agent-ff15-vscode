## Why

Issue #21 established the Mission Workbench and bundled operations catalog, but operation-backed missions still have no extension-owned runtime to attach to and no local bridge contract for agent panes to call back into the extension. Issue #22 is the architectural probe that decides whether the extension-host bridge is viable enough to keep building on, or whether later runtime slices need a fallback transport instead.

## What Changes

- Add an extension-owned operation engine probe that can start or attach to a mission-scoped runtime lifecycle for operation-backed missions and surface `starting`, `ready`, and `unavailable` states in the Mission Workbench.
- Generate workspace-local bridge scripts under `.ff15` that can reach extension-host runtime entry points for mission lookup, workflow lookup, task submission, and report submission.
- Persist mission workflow bridge metadata and a concrete `go` or `no-go` probe verdict on the canonical mission runtime so later slices can keep the same workbench contract.
- Add focused tests for runtime probing, bridge-script materialization, workbench state updates, and probe outcome persistence.

## Capabilities

### New Capabilities
- `ff15-operation-engine-probe`: Start or attach to an extension-owned operation runtime for an operation-backed mission and surface the runtime state plus probe verdict in the Mission Workbench.
- `ff15-operation-bridge-scripts`: Materialize workspace-local bridge scripts and manifest data that let local agent panes call extension-owned mission and workflow lookup plus task and report submission entry points.

### Modified Capabilities
- None.

## Impact

- Affected extension-host code includes mission runtime persistence, Mission Workbench controller state, and new operation-runtime or bridge modules under `src/features/ff15-operations`.
- Affected workspace runtime data includes generated bridge assets under `.ff15` plus per-mission workflow metadata persisted in `.ff15/missions/<missionId>/mission.json`.
- Affected UI code includes the Mission Workbench route and any shared mission-state types it consumes.
- Affected validation includes focused tests for runtime readiness states, bridge endpoints, bridge-script generation, and recorded `go` or `no-go` outcomes.