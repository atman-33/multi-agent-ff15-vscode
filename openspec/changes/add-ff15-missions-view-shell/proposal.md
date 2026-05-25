## Why

The FF15 sidebar currently has Launch and Settings, but no mission-focused workspace where the user can organize work before message delivery is fully wired. A dedicated Missions view is needed now so issue #12 can establish the sidebar shell, lightweight mission state, and Noctis composer contract that later mission transport slices will build on.

## What Changes

- Add a dedicated Missions view inside the FF15 activity bar container alongside Launch and Settings.
- Introduce lightweight extension-managed mission records that support create, list, select, and restore behavior without depending on the sibling multi-agent-ff15 repository.
- Render a Missions webview route that combines mission list UI with a Noctis composer shell, including empty and disabled states when no mission is selected.
- Add focused tests for manifest wiring, activation/provider registration, and mission state persistence behavior.

## Capabilities

### New Capabilities
- `ff15-missions-view-shell`: Provide a sidebar Missions view that lets the user create and select lightweight missions and exposes a Noctis composer shell for the selected mission.

### Modified Capabilities
- None.

## Impact

- Affected extension metadata includes FF15 sidebar view contributions and shared identifier constants.
- Affected extension-host code includes activation wiring, a new Missions view provider, and lightweight mission state helpers under `src/`.
- Affected webview UI includes a new Missions route rendered through the existing shared webview shell.
- Affected tests include focused unit tests for manifest contributions, activation wiring, provider messaging, and mission state restoration.