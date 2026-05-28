## Why

Operation-backed missions already persist canonical state under `.ff15`, but VS Code reloads and mission re-selection still break continuation because the extension does not fully recover runtime bridge readiness and workflow context from that state. Issue #26 closes that gap so users can reopen the Mission Workbench and continue an existing operation-backed mission instead of recreating it.

## What Changes

- Rehydrate operation-backed mission runtime metadata from `.ff15` after extension reloads and mission re-selection.
- Rebuild loopback bridge assets and runtime readiness for hydrated missions when the Mission Workbench reopens.
- Preserve enough workflow identity for continuation, including selected operation, active step, active task, probe metadata, session information, and bridge manifest availability.
- Add focused tests covering reload hydration and Mission Workbench continuation flows.

## Capabilities

### New Capabilities
- `ff15-operation-mission-reload-recovery`: Recover operation-backed missions after reload and workbench reopen using canonical mission runtime state.

### Modified Capabilities
- None.

## Impact

- Affected extension-host code includes mission runtime hydration, runtime probe bootstrap, and Mission Workbench reopen flow.
- Affected runtime artifacts include `.ff15/missions/<missionId>/mission.json` and `.ff15/bridge/*` assets.
- Affected validation includes focused mission/workbench/runtime-probe tests plus repository lint, test, and compile checks.