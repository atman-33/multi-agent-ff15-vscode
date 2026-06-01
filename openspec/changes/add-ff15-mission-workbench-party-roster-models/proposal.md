## Why

The Mission Workbench needs a mission-local control surface for the fixed FF15 party so User can see live pane availability, nudge an active agent, and change OpenCode models without leaving the mission surface. The OpenCode model change flow is command-driven and model-specific, so the workbench needs a durable contract before the UI and extension host route those actions.

## What Changes

- Add a bottom-of-workbench party roster for Noctis, Ignis, Gladiolus, and Prompto with minimal session and pane availability state.
- Add raw per-agent Continue actions routed through the extension host to the selected live pane.
- Define OpenCode model master data as model-scoped entries, including effort options per model and support for models with no effort step.
- Add per-agent model display, persistence, projection, and model change routing using `/model`, Enter, model name, Enter, and an optional effort number.

## Capabilities

### New Capabilities

- `mission-workbench-party-roster`: Mission Workbench party roster state projection, raw continue actions, and per-agent OpenCode model controls.

### Modified Capabilities

None.

## Impact

- Extension host Mission Workbench controller and mission state persistence.
- Mission transport command routing for raw Continue and OpenCode model interaction input.
- Mission Workbench webview UI and webview message contract.
- Focused extension-host and webview tests for roster projection, routing, persistence, and model-scoped effort options.