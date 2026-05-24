## Why

multi-agent-ff15-vscode still exposes boilerplate sample views and has no FF15-specific entry point for starting work. A minimal launch surface is needed now so the extension can provide one obvious action that validates local dependencies and opens Zellij from the active VS Code workspace without relying on the sibling multi-agent-ff15 repository.

## What Changes

- Replace the sample-oriented sidebar experience with a minimal FF15 launch surface.
- Add a primary launch action that uses the active VS Code workspace root as the working directory.
- Validate that `zellij` and `opencode` are available on PATH before launch.
- Start Zellij in a new external terminal window and stop with a clear error when dependencies are missing.
- Add extension-side tests for dependency validation and launch command orchestration.

## Capabilities

### New Capabilities
- `ff15-launch-surface`: Provide a minimal sidebar launch surface that validates dependencies and starts Zellij from the active VS Code workspace.

### Modified Capabilities
- None.

## Impact

- Affected code includes the extension activation flow, sidebar/webview provider wiring, webview UI for the launch surface, and new launch orchestration helpers.
- Affected external dependencies are the locally installed `zellij` and `opencode` executables resolved from PATH.
- Affected tests include extension-side unit tests for dependency checks, command construction, and terminal launch behavior.