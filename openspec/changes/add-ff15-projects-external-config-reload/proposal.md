## Why

The Projects editor currently assumes the extension is the only writer of the resolved harness config and profile files. When those files change externally, the open editor can keep showing stale state or overwrite on-disk changes without first letting the user decide how to resolve the conflict.

## What Changes

- Watch the resolved Projects config file and project profile directory while the Projects editor is open.
- Auto-refresh the Projects editor state when external changes land and there is no pending local draft.
- Surface an explicit conflict state when external changes arrive while the Projects editor has pending local edits, with resolution actions for reload, discard local, and keep local.
- Add focused controller and UI coverage for watcher-driven refreshes and each conflict-resolution branch.

## Capabilities

### New Capabilities
- `ff15-projects-external-config-reload`: Keep the Projects editor synchronized with external config/profile changes without silently overwriting pending local edits.

### Modified Capabilities
- None.

## Impact

- Affected extension host code: `src/features/ff15-projects/workbench-controller.ts` for watcher setup, conflict tracking, and resolution actions.
- Affected UI: `webview-ui/src/app/routes/ff15-projects-workbench/route.tsx` and supporting Projects model code for conflict messaging and explicit resolution controls.
- Affected tests: `src/features/ff15-projects/workbench-controller.test.ts` plus any touched webview model tests for conflict-state behavior.