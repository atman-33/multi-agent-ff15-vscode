## Context

Issue #2 introduced the FF15 launch surface, workspace-root resolution, dependency checks, and a terminal adapter that opens Zellij from VS Code. The current flow still launches plain `zellij`, so it does not create the intended FF15-style four-agent view. This change needs to add a packaged layout asset, wire the controller to use it, and support argument-based terminal launch on Windows where the current helper only handles an executable path.

## Goals / Non-Goals

**Goals:**

- Package a repo-owned Zellij layout file that defines the initial 2x2 FF15 roster.
- Launch FF15 through `zellij --layout <file>` so the bundled template is the only source of truth for the initial layout.
- Start Noctis, Ignis, Gladiolus, and Prompto with matching `opencode --agent <agent>` pane commands.
- Keep the launch flow testable with focused unit tests around layout resolution and launch command construction.

**Non-Goals:**

- Supporting user-customizable rosters, pane counts, or layout editing.
- Managing OpenCode server ports or advanced runtime coordination inside the extension.
- Reworking the FF15 webview UX beyond the existing launch trigger and status flow.

## Decisions

### Store the Zellij layout as a packaged extension asset

The roster layout will live in a versioned file under the extension repository so the repo owns the exact pane topology and pane commands. The controller layer will resolve that file from the extension installation root instead of generating inline KDL at runtime.

Alternative considered: generate the layout string in TypeScript. Rejected because it would split the source of truth across code and tests, and makes the bundled roster harder to inspect or evolve.

### Pass launch input as executable plus arguments

The terminal launch contract will change from a single shell command string to an executable with structured arguments. On Windows, the helper will map these values to `Start-Process -FilePath ... -ArgumentList ...`; on non-Windows, it will render the same input to a shell command before sending it to the VS Code terminal.

Alternative considered: keep passing a single command string. Rejected because the current Windows helper treats the whole string as the executable path, so `zellij --layout ...` would fail once arguments are introduced.

### Isolate roster metadata in a dedicated helper

The fixed agent roster and the logic that converts the bundled layout path into launch arguments will live in FF15 launch helpers instead of being embedded directly in the controller. This keeps controller tests focused on observable behavior and makes the roster definition explicit in one place.

Alternative considered: hardcode layout path and arguments inside `controller.ts`. Rejected because it would mix dependency validation, workspace resolution, and launch command assembly in one unit.

## Risks / Trade-offs

- [Packaged asset not found at runtime] -> Resolve the layout path from the extension root and fail fast with a clear error covered by tests.
- [Windows quoting breaks layout paths with spaces] -> Use structured executable/argument launch input instead of concatenated shell strings.
- [Fixed roster becomes a maintenance bottleneck] -> Keep roster membership explicit and isolated so a later change can replace only the helper and layout asset.