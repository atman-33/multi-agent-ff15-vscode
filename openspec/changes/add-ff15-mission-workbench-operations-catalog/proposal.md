## Why

The extension can already create mission-scoped sessions and persist mission runtime data under `.ff15`, but it still has no operation entry surface. Users cannot pick a bundled FF15 operation for a mission, and the current Missions sidebar is too narrow to own mission selection, terminal controls, operation selection, and prompt composition at the same time.

This slice is needed now because issue #21 is the first end-to-end entry point for mission-scoped operations. It must prove that the extension can materialize bundled operation assets into the workspace and move mission interaction into a main-editor Mission Workbench without depending on the sibling multi-agent-ff15 runtime at execution time.

## What Changes

- Package bundled builtin FF15 operation definition assets with the extension and materialize them into the active workspace under `.ff15/operations` using refresh behavior that does not overwrite unrelated mission runtime state.
- Introduce a Mission Workbench in the editor area that opens from the Missions list and becomes the primary mission interaction surface for operation-backed work.
- Narrow the Missions sidebar to mission navigation and high-level status so the sidebar opens or focuses the Mission Workbench instead of owning the full composer workflow.
- Show supported bundled operations and explicit unsupported bundled operations in the Mission Workbench, and persist the selected `operationRef` on the mission record.

## Capabilities

### New Capabilities
- `ff15-operations-catalog`: Materialize bundled builtin operation definitions into the active workspace and expose a stable mission-facing catalog with supported and unsupported operation entries.
- `ff15-mission-workbench`: Open a dedicated mission workbench in the editor area from the Missions list and use it as the primary surface for mission controls, operation selection, and mission status.

### Modified Capabilities
- None.

## Impact

- Affected extension-host code includes mission state persistence, workspace runtime materialization, Missions view controller or provider wiring, and a new editor-area mission surface.
- Affected UI code includes the Missions sidebar route plus a new Mission Workbench route or panel flow in the shared webview shell.
- Affected runtime data includes `.ff15/operations/**` and mission records that persist the selected `operationRef`.
- Affected validation includes focused tests for catalog materialization, mission selection and workbench opening, supported versus unsupported operation presentation, and `operationRef` persistence.