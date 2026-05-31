## Why

The extension now resolves Projects configuration, but Launch and Missions still treat a single workspace root as execution root, project root, and OpenSpec root at the same time. Issue #48 is needed to make runtime context propagation match the resolved Projects contract so launch/session behavior and operation prompt inputs stay deterministic when `openspec.project_id` is decoupled from `active_projects`.

## What Changes

- Add a shared FF15 runtime-context contract that derives execution root from the first workspace-folder rule while deriving OpenSpec context from the resolved Projects configuration.
- Update Launch and mission session orchestration to consume the runtime root instead of assuming the active workspace root is also the project/OpenSpec root.
- Update operation prompt composition inputs to carry resolved OpenSpec path semantics for both `project` and `harness` modes.
- Preserve backward compatibility for existing `.agents/harness` workflows by continuing to load the same harness config sources while changing only downstream context propagation.

## Capabilities

### New Capabilities
- `ff15-project-runtime-context`: Propagates resolved Projects configuration into Launch, mission session setup, and operation prompt context so runtime execution root and OpenSpec root are computed independently.

### Modified Capabilities
- None.

## Impact

- Affected extension areas: launch workspace-root resolution, mission session/orchestration controllers, prompt composition inputs, and shared Projects-context consumers.
- Affected runtime behavior: terminal/session cwd selection, OpenSpec path injection, and mission prompt context for both `project` and `harness` modes.
- Tests: add focused coverage for runtime-context propagation through launch/session setup and mission prompt composition while preserving `.agents/harness` compatibility.