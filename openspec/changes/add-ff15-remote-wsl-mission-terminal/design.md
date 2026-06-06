## Context

`launchZellijTerminal` in `src/features/ff15-launch/launch-terminal.ts` already detects Remote - WSL via `env.remoteName === "wsl"` and routes to a host-terminal bridge. The mission session controller (`session-controller.ts`) calls `dependencies.launchTerminal()`, which the VS Code wiring (`vscode-controller.ts`) connects directly to `launchZellijTerminal`. Therefore, when a mission terminal is reopened from the Mission Workbench in Remote - WSL, the external host terminal path is already active.

What remains is focused test coverage that verifies the mission session controller correctly surfaces WSL-specific launch errors (`MISSING_REMOTE_WSL_DISTRO_MESSAGE`, `REMOTE_WSL_BRIDGE_FAILURE_MESSAGE`) as distinct user-visible messages and does not regress existing mission reopen behavior.

## Goals / Non-Goals

**Goals:**
- Add session-controller tests that verify WSL-specific errors propagate to mission-scoped error state.
- Add session-controller tests that verify the user-visible error message for WSL bridge failures is distinct from missing-zellij and missing-launch-client errors.
- Ensure existing mission terminal reopen tests continue to pass without modification.

**Non-Goals:**
- Modify `launchZellijTerminal` or any other WSL detection logic.
- Add end-to-end integration tests against a real WSL environment.
- Change the Mission Workbench UI or the terminal reopen button behavior.

## Decisions

- Test the session controller in isolation by injecting mock `launchTerminal` dependencies that throw WSL-specific errors. This is consistent with the existing test pattern where all dependencies are mocked.
  - Alternative considered: integration tests with real WSL. Rejected because the test environment does not guarantee a WSL setup, and the `launchZellijTerminal` function is already separately tested for WSL command construction.
- No changes to error message constants in the session controller. The existing `MISSION_LAUNCH_FAILED_MESSAGE` fallback combined with `getErrorMessage()` already surfaces WSL-specific messages correctly.
  - Alternative considered: adding mission-specific WSL error constants. Rejected because the session controller delegates to `launchTerminal`, which is responsible for producing WSL-specific errors.

## Risks / Trade-offs

- Low risk: the code path through `launchZellijTerminal` is already exercised by the roster launch, and the session controller error handling is generic enough to propagate any error message.
- Test coverage gap: without these tests, a future refactor could accidentally mask WSL-specific errors behind the generic `MISSION_LAUNCH_FAILED_MESSAGE`. → Mitigated by the new tests.
