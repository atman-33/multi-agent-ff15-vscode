## Why

The FF15 VS Code extension currently relies on agent definition files already existing in the target workspace, but the extension package does not provision them. This makes first-run launch behavior fragile and prevents extension updates from reliably refreshing the GitHub Copilot and OpenCode agent prompts that FF15 depends on.

## What Changes

- Add bundled FF15 agent definition files under `src/resources/workspace-template` as the single source of truth, mirroring the workspace-relative `.github/agents` and `.opencode/agents` paths.
- Materialize the bundled agent files into the active workspace at extension activation, writing `.github/agents/*.agent.md` and `.opencode/agents/*.md` automatically.
- Overwrite managed workspace agent files on each activation so extension updates refresh the deployed prompts without extra user action.
- Remove the repository-root duplicate agent folders once the bundled resource layout becomes authoritative.
- Add focused tests for activation-time materialization and the file-copy helper behavior.

## Capabilities

### New Capabilities
- `ff15-workspace-agent-materialization`: Bundle FF15 agent definition files with the extension and automatically materialize the managed GitHub Copilot and OpenCode agent files into the active workspace on activation.

### Modified Capabilities

None.

## Impact

- Affected code includes extension activation wiring plus a new or shared workspace materialization helper under `src/features` or `src/lib`.
- Affected packaged assets include a mirrored workspace template tree under `src/resources/workspace-template` and VSIX packaging rules that must retain it.
- Affected workspace state includes managed files under `.github/agents` and `.opencode/agents` in the launched workspace.
- Affected tests include focused activation tests and helper-level materialization tests.