## Why

The FF15 roster launch (Settings view) already uses an external host terminal in Remote - WSL. The Mission Workbench "Open Terminal" / "Reopen Terminal" flow shares the same `launchZellijTerminal` function, so WSL terminal behavior is technically in place, but the mission-session controller lacks focused test coverage that verifies WSL-specific launch outcomes and error distinction for this user-facing path.

## What Changes

- Add tests for the mission session controller that verify Remote - WSL launch errors (WSL_DISTRO_NAME missing, host bridge failure) are surfaced as distinct user-visible messages separate from missing-zellij and missing-launch-client errors.
- Ensure the mission session controller does not regress existing non-WSL terminal reopen behavior.

## Capabilities

### New Capabilities
- `remote-wsl-mission-terminal-reopen`: The Mission Workbench terminal reopen shall use the same Remote - WSL external-terminal behavior as the roster launch, with WSL-specific failures surfaced distinctly from Linux-side dependency failures.

### Modified Capabilities

## Impact

- Affected code: `src/features/ff15-missions/session-controller.test.ts`
- Systems: Mission session controller error handling, existing `launchZellijTerminal` WSL bridge
- Dependencies: no new package dependencies; relies on the existing Remote - WSL launch bridge introduced in `add-ff15-remote-wsl-roster-launch`
