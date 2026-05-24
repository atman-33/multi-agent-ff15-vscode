## Why

The FF15 activity bar currently exposes only the Launch view, so users have no clear in-context path to the extension's settings. This slice adds a dedicated Settings view so launch stays focused on starting FF15 while configuration remains easy to find.

## What Changes

- Add a dedicated Settings view under the FF15 activity bar alongside the existing Launch view.
- Add an FF15-specific extension command that opens the extension's settings namespace directly in VS Code.
- Wire the Settings view UI to trigger that command instead of mixing configuration controls into the Launch view.
- Add focused verification for the new manifest contributions and settings-open behavior.

## Capabilities

### New Capabilities
- `ff15-settings-view`: Expose a dedicated FF15 Settings sidebar view that opens the extension's settings namespace through an FF15-specific command.

### Modified Capabilities

None.

## Impact

- Affected extension metadata includes the FF15 sidebar view contributions and the new settings command contribution in `package.json`.
- Affected extension-host code includes activation wiring plus new FF15 settings command and view-provider modules under `src/`.
- Affected webview UI includes a dedicated FF15 settings route rendered inside the sidebar view.
- Affected tests include focused verification for settings command execution, sidebar wiring, and manifest contributions.