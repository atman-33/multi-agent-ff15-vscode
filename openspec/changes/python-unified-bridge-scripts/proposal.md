## Why

The extension currently generates PowerShell (.ps1) bridge scripts in `.ff15/bridge/` to let agents communicate with the operation engine. These scripts are Windows-only and cannot be executed in WSL, Linux, or macOS terminals. To make the extension truly cross-platform, we will unify the bridge scripts to Python (.py), which is available on all target platforms.

## What Changes

- **BREAKING**: Remove generation of `.ps1` bridge scripts (`get-mission.ps1`, `get-workflow.ps1`, `submit-task.ps1`, `submit-report.ps1`).
- Add generation of equivalent `.py` bridge scripts (`get-mission.py`, `get-workflow.py`, `submit-task.py`, `submit-report.py`).
- Each `.py` script reads `bridge-manifest.json` from its own directory to obtain `baseUrl` and `token`.
- Update `buildStepCompletionContract` and callers to reference `.py` paths in prompts instead of `.ps1`.
- Update all tests that assert `.ps1` file existence or path strings to assert `.py` instead.

## Capabilities

### New Capabilities
- `python-bridge-scripts`: Generation and usage of Python bridge scripts for cross-platform agent-to-engine HTTP communication.

### Modified Capabilities
- (none – no existing spec-level requirements are changing; this is a platform-level implementation swap)

## Impact

- `src/features/ff15-operations/runtime-probe.ts` — script generation logic.
- `src/features/ff15-operations/definition.ts` — prompt construction referencing bridge script paths.
- `src/features/ff15-operations/runtime-probe.test.ts` — assertions for generated files.
- `src/features/ff15-operations/definition.test.ts` — prompt content assertions.
- `src/features/ff15-missions/controller.test.ts` — prompt content assertions.
- End users must have Python 3 installed on their system (Windows, WSL, Linux, macOS).
