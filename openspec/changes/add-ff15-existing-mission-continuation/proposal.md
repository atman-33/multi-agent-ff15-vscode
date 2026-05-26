## Why

The Missions view can launch a new Noctis conversation, but it cannot safely resume an existing mission after the extension reloads. Issue #14 is needed now so stored missions can reopen, rehydrate their transport metadata, and continue the same mission-scoped conversation instead of silently starting over.

## What Changes

- Persist the mission session metadata needed to find the existing Noctis pane after the extension reloads and sidebar rehydration.
- Extend the existing-mission send path so selecting a stored mission and submitting a new prompt targets the stored mission-scoped Zellij session instead of creating a replacement session.
- Surface a recoverable mission error when the stored session can no longer resolve a live Noctis pane, so the user can recover instead of sending into a dead target.
- Add focused tests for mission rehydration, existing-mission send behavior, and the stale-session error path.

## Capabilities

### New Capabilities
- `ff15-existing-mission-continuation`: Rehydrate stored mission transport metadata and continue prompts in the existing Noctis mission session from the sidebar.

### Modified Capabilities

## Impact

- Affected extension-host code includes the missions controller, mission runtime persistence, transport reconciliation, and extension activation rehydration paths.
- Affected tests include focused coverage for mission restore, existing-mission send behavior, and stale-pane recovery handling.
- Affected workspace runtime data includes `.ff15/missions/<missionId>/mission.json` records that must retain the metadata required to target a live Noctis pane across reloads.