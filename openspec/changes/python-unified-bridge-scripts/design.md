## Context

The extension currently generates four PowerShell `.ps1` bridge scripts (`get-mission.ps1`, `get-workflow.ps1`, `submit-task.ps1`, `submit-report.ps1`) under `.ff15/bridge/`. These scripts read `bridge-manifest.json` and call the operation engine via `Invoke-RestMethod`. This works on native Windows but fails in WSL, Linux, and macOS terminals where PowerShell is unavailable.

## Goals / Non-Goals

**Goals:**
- Replace `.ps1` bridge scripts with equivalent `.py` scripts.
- Ensure the generated `.py` scripts run on Windows, WSL, Linux, and macOS without additional dependencies beyond Python 3.
- Update all prompt construction and test assertions to reference `.py` paths.

**Non-Goals:**
- Changing the `bridge-manifest.json` schema or its content.
- Changing the HTTP API surface of the operation engine.
- Modifying terminal launch logic (e.g., `launch-terminal.ts`); only the bridge scripts themselves change.
- Keeping `.ps1` scripts as a fallback; this is a clean migration to Python.

## Decisions

### Use Python 3 with `urllib.request`
- **Rationale**: Python 3 ships with WSL distributions, macOS, and most Linux distributions. Windows users can install it from the Microsoft Store or other channels. `urllib.request` is in the standard library, so no `pip` packages are needed.
- **Alternative considered**: Node.js scripts — rejected because the terminal’s Node runtime is not guaranteed to match the extension host’s Node.

### Scripts read `bridge-manifest.json` at runtime
- **Rationale**: Keeps the same pattern as `.ps1` scripts. The script resolves its own directory (`os.path.dirname(__file__)`) to find the manifest. This avoids hard-coding URLs/tokens into the script source.
- **Alternative considered**: Hard-code manifest values into `.py` at generation time — rejected because it complicates rotation or dynamic manifest updates.

### Remove `.ps1` generation entirely
- **Rationale**: Maintaining both `.ps1` and `.py` doubles the generation logic and test surface. The user explicitly requested a unified Python approach.
- **Trade-off**: This is a **breaking change** for existing Windows-only users who do not have Python installed.

## Risks / Trade-offs

- **[Risk]** Windows users may not have Python 3 installed.
  - **Mitigation**: Python 3 is widely available on Windows via the Microsoft Store and standard installers. The extension documentation already assumes a developer environment.
- **[Risk]** Some WSL distributions (e.g., minimal Alpine containers) may not include Python 3.
  - **Mitigation**: The most common WSL distros (Ubuntu, Debian) include Python 3 by default. Users of minimal distros can install it easily.
- **[Risk]** Legacy Python 2 may be invoked if `python` points to Python 2.
  - **Mitigation**: Scripts use a `python3` shebang comment (`#!/usr/bin/env python3`) and the extension documentation will state the Python 3 requirement.

## Migration Plan

1. Update `runtime-probe.ts` to generate `.py` scripts instead of `.ps1`.
2. Update `definition.ts` to embed `.py` paths in prompts.
3. Update all affected tests.
4. Update extension documentation to mention the Python 3 requirement.

There is no runtime migration of existing `.ps1` files; they will simply not be regenerated on the next mission runtime activation.

## Open Questions

- Should we add a runtime check that warns the user if `python3` is not found in the terminal environment?
  - *Deferred*: Can be added as a follow-up UX improvement.
