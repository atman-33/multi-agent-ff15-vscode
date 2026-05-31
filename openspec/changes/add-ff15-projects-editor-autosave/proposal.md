## Why

The Projects sidebar currently exposes FF15 session context as read-only data, which forces users to leave the extension whenever they need to change active projects or the OpenSpec source. Issue #47 moves that workflow into the extension so project selection stays visible, fast, and aligned with the current workspace.

## What Changes

- Turn the Projects view into an editable surface for `active_projects`, `openspec.mode`, and `openspec.project_id`.
- Add debounced auto-save in the webview/provider flow so configuration edits persist after a short idle window instead of requiring an explicit save action.
- Update harness config read/write handling to preserve YAML comments and key order while normalizing saved `active_projects` values.
- Limit hard failures to schema and profile-id integrity errors, while surfacing path/default-check problems as warnings in the Projects UI.

## Capabilities

### New Capabilities
- `ff15-projects-editor-autosave`: Edit and auto-save FF15 project/session selection from the Projects sidebar.

### Modified Capabilities
- None.

## Impact

- Affected extension host code: `src/features/ff15-projects/context-resolver.ts`, `provider.ts`, and new write helpers for harness config updates.
- Affected UI: `webview-ui/src/app/routes/ff15-projects/route.tsx` becomes an editable Projects surface.
- Affected tests: resolver/provider/webview tests need coverage for edit state, debounce save behavior, rollback, and warning-only diagnostics.