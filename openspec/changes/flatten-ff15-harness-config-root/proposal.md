## Why

The FF15 Projects context resolver currently stores configuration under an extra `.ff15/harness` nesting (`config` and `projects` live inside it). This intermediate directory adds no value because `.ff15` already serves as the workspace-local FF15 runtime root. Flattening the structure makes the layout cleaner and aligns the config root with the rest of the `.ff15` runtime directories.

## What Changes

- **BREAKING**: Move the FF15 Projects configuration root from `.ff15/harness` to `.ff15`.
  - `agent-harness.yaml` moves from `.ff15/harness/config/` to `.ff15/config/`.
  - Project profiles move from `.ff15/harness/projects/` to `.ff15/projects/`.
- Existing `.ff15/harness` directories are ignored; users must move files manually if needed.
- Change the resolver's "config exists" detection from the `.ff15/harness` directory to `.ff15/config/agent-harness.yaml`, because `.ff15` itself may already exist for missions/operations/bridge.
- Update the harness owner root calculation from `dirname(dirname(harnessRoot))` to `dirname(ff15Root)`.
- Update user-facing labels and the bootstrap notification to reference `.ff15` instead of `.ff15/harness`.
- Update affected tests and README documentation.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `ff15-projects-context-resolver`: The configuration source root changes from `.ff15/harness` to `.ff15`, and the existence check becomes file-based (`config/agent-harness.yaml`) rather than directory-based.

## Impact

- `src/features/ff15-projects/context-resolver.ts` — resolution root, bootstrap paths, owner root calculation.
- `src/features/ff15-projects/provider.ts` — bootstrap notification message.
- `webview-ui/src/app/routes/ff15-projects/model.ts` — source kind label.
- Tests: `context-resolver.test.ts`, `runtime-context.test.ts`, `provider.test.ts`, `workbench-controller.test.ts`.
- `README.md` — documentation of the config root location.
