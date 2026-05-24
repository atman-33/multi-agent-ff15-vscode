## Why

The current FF15 launch flow only starts a plain Zellij session, so users cannot get the intended FF15-style four-agent view from the extension. This slice is needed now because issue #2 already established the launch surface and dependency checks, leaving the bundled roster layout as the next visible step.

## What Changes

- Add a repo-bundled Zellij layout template that defines a fixed 2x2 roster for Noctis, Ignis, Gladiolus, and Prompto.
- Generate the launch command from the bundled template so the extension starts the same layout every time.
- Start each pane with the matching OpenCode agent identity command.
- Add tests for layout path resolution, launch command generation, and terminal launch orchestration.

## Capabilities

### New Capabilities
- `ff15-zellij-roster-layout`: Launch FF15 with a repo-owned 2x2 Zellij layout that starts the fixed four-agent roster.

### Modified Capabilities

None.

## Impact

- Affected code includes the FF15 launch controller, terminal launch adapter, and supporting launch helpers under `src/features/ff15-launch`.
- Affected packaged assets include the bundled Zellij layout template stored in the extension repository.
- Affected dependencies remain the locally installed `zellij` and `opencode` executables resolved from PATH.
- Affected tests include extension-side unit tests for layout asset resolution and launch command construction.