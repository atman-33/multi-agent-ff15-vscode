## Why

Issue #22 proved that operation-backed missions can surface runtime readiness and generate workspace-local bridge assets, but the first Noctis send path still behaves like a free-form mission prompt. Issue #23 is needed now so selecting an operation in the Mission Workbench actually activates workflow state, persists canonical step metadata, and sends Noctis an operation-aware prompt instead of raw user text.

## What Changes

- Activate workflow state on the first send for a mission with a selected operation by loading the operation definition from workspace-local `.ff15/operations` and persisting canonical step metadata on the mission record.
- Deliver an operation-aware Noctis prompt that includes active operation and step context while staying self-contained inside the extension runtime.
- Reuse the existing Mission Workbench state flow so the selected operation, current step, active task, and runtime status remain visible after activation.
- Add focused tests for operation-backed send activation, canonical workflow metadata persistence, and operation-aware prompt delivery.

## Capabilities

### New Capabilities
- `ff15-operation-send-step`: Activate the first workflow step for an operation-backed mission and deliver an operation-aware Noctis prompt based on the selected workspace-local operation definition.

### Modified Capabilities
- None.

## Impact

- Affected extension-host code includes the mission send controller, mission runtime persistence, and new operation-definition loading helpers under `src/features/ff15-operations`.
- Affected runtime data includes `.ff15/missions/<missionId>/mission.json`, where workflow step metadata becomes canonical mission state.
- Affected Mission Workbench behavior includes reflecting activated workflow step metadata after the send completes.
- Affected validation includes focused send-controller tests plus repository lint, test, and compile checks.