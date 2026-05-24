## Why

The current FF15 launch flow hardcodes OpenCode-specific dependency checks and executable resolution into the controller and layout helpers. This prevents FF15 from launching with sensible defaults when the user has not changed settings, and it blocks the first GitHub Copilot CLI-backed launch slice.

## What Changes

- Introduce a launch client abstraction that encapsulates client-specific dependency validation, executable resolution, fixed-roster pane command generation, and user-facing dependency messaging.
- Make GitHub Copilot CLI the default FF15 launch client when the user has not changed the extension setting, while keeping OpenCode as an explicit option.
- Refactor the FF15 launch controller to depend on the launch client contract instead of hardcoded provider checks.
- Generate the fixed 2x2 roster layout from a provider-independent pane launch plan while preserving the existing workspace-root and external Zellij launch behavior.
- Add focused tests for launch client selection, dependency validation, layout rendering, and controller behavior.

## Capabilities

### New Capabilities
- `ff15-launch-client-abstraction`: Select a launch client for FF15, default to GitHub Copilot CLI, and build the fixed roster launch flow through a provider-agnostic client contract.

### Modified Capabilities

None.

## Impact

- Affected code includes the FF15 launch controller, VS Code controller wiring, layout helpers, and new launch-client helpers under `src/features/ff15-launch`.
- Affected extension metadata includes the VS Code configuration surface used to select the FF15 launch client.
- Affected external dependencies remain `zellij` plus whichever executable is required by the selected launch client.
- Affected tests include focused unit tests around launch client resolution, dependency checks, pane launch planning, and controller launch behavior.