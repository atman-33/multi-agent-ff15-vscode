## Why

FF15 roster launch currently supports local Windows external terminals and falls back to an integrated terminal elsewhere. In VS Code Remote - WSL, that fallback keeps launch inside the remote window instead of opening a host terminal, so the Settings-driven launch flow does not meet the expected external-launch behavior.

## What Changes

- Add a Remote - WSL launch path that bridges to the Windows host terminal and runs the FF15 zellij roster inside the active WSL distro.
- Keep workspace roots and rendered layout paths as Linux-visible paths for Remote - WSL launches.
- Surface Remote - WSL bridge failures as a distinct user-visible launch error.
- Add focused tests for Remote - WSL command assembly and launch outcome handling.
- Update README launch-environment guidance to document local Windows and Remote - WSL support.

## Capabilities

### New Capabilities
- `remote-wsl-roster-launch`: Launch the Settings-driven FF15 roster in an external host terminal when the extension runs in VS Code Remote - WSL.

### Modified Capabilities

## Impact

- Affected code: `src/features/ff15-launch/*`, related tests, and `README.md`.
- Systems: VS Code Remote API detection, Windows-side launch bridge via `powershell.exe`, and WSL invocation via `wsl.exe`.
- Dependencies: no new package dependencies; behavior relies on existing Windows host bridge availability at launch time.