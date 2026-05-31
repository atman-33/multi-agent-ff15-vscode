## Why

Missions are currently created with generic sequential titles, which makes the sidebar and mission workbench harder to scan once several conversations exist. This change is needed now because the first message the user sends already contains a human-meaningful summary of the mission, and the UI should also allow that title to be corrected later without affecting the mission runtime identity.

## What Changes

- Allow a mission title to be edited after mission creation from the Mission Workbench.
- On the first successful Send to Noctis attempt for a mission that still has the default generated title, derive the mission title from the submitted message using a normalized, length-limited summary.
- Keep mission runtime identity stable by leaving mission ids and session names unchanged when the visible title changes.
- Add focused tests for mission title persistence, first-send auto-title behavior, and workbench rename interactions.

## Capabilities

### New Capabilities
- `ff15-mission-title-customization`: Let users rename missions explicitly and promote the first Noctis prompt into the initial visible mission title.

### Modified Capabilities

## Impact

- Affected extension-host code includes the missions store, mission send controller, and mission workbench controller.
- Affected webview UI includes the Mission Workbench header and message flow for title editing.
- Affected tests include focused coverage for mission title persistence, first-send title derivation, and workbench rename messaging.