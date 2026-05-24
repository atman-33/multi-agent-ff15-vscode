## Context

Issue #2 introduced the FF15 launch surface, workspace-root resolution, and terminal launch orchestration. Issue #3 then added the fixed 2x2 Zellij roster, but the current implementation still assumes OpenCode at every layer: the controller validates `opencode`, the layout helper resolves an OpenCode executable, and the bundled roster template hardcodes OpenCode pane commands. This slice needs to isolate client-specific launch behavior before the extension can default to GitHub Copilot CLI and add more providers safely.

## Goals / Non-Goals

**Goals:**

- Introduce a launch-client contract that keeps provider-specific dependency checks and pane command generation out of the controller.
- Default FF15 launch to GitHub Copilot CLI when no user setting is present.
- Preserve the fixed Noctis, Ignis, Gladiolus, and Prompto 2x2 roster while generating pane launch input from provider-agnostic data.
- Keep the launch flow testable with focused unit tests around selection, dependency validation, layout rendering, and controller orchestration.

**Non-Goals:**

- Adding a user-facing picker or webview UX for launch-client selection in this slice.
- Inventing new GitHub Copilot CLI arguments beyond the currently supported executable contract.
- Changing how the extension resolves the active workspace root or opens Zellij in an external terminal.

## Decisions

### Resolve one launch client before entering the controller

The VS Code-specific wiring layer will read the configured launch-client id, apply a default of GitHub Copilot CLI, and pass the resolved client into the controller. The controller will depend on a single launch-client interface and will not branch on provider ids.

Alternative considered: pass a provider id into the controller and switch on it internally. Rejected because it keeps client-specific branching in the orchestration layer that issue #7 explicitly wants to remove.

### Model the fixed roster as a provider-independent pane launch plan

The launch client will produce the executable path and arguments needed for each roster pane, while the layout helper will only render that plan into the bundled Zellij template. This keeps the roster topology provider-agnostic and allows client implementations to vary only the per-pane command contract. For GitHub Copilot CLI, the pane launch plan will use the documented `--agent <custom-agent>` contract so each pane can launch the matching FF15 agent persona through the repository's `.github/agents/*.agent.md` definitions.

Alternative considered: use the documented `-i` interactive startup prompt to bootstrap each persona with a freeform instruction. Rejected because this repository already defines matching GitHub Copilot custom agents, and `--agent` keeps FF15 launch aligned with the OpenCode workflow without relying on prompt wording.

### Add a dedicated extension setting for launch-client selection

The extension manifest will expose a string or enum configuration value for FF15 launch-client selection, with GitHub Copilot CLI as the default. The VS Code controller wiring will resolve this setting once and choose the matching launch-client implementation.

Alternative considered: infer the client from installed executables with no explicit setting. Rejected because it creates unstable defaults and makes the selected client unclear to the user.

## Risks / Trade-offs

- [GitHub Copilot CLI contract is narrower than OpenCode] -> Keep the launch-client interface focused on executable resolution and fixed roster pane plans, and do not invent unsupported CLI flags.
- [Configuration and implementation drift] -> Make the launch-client ids explicit in one module and cover default resolution with tests.
- [Layout templating becomes harder to read with per-pane placeholders] -> Keep the roster topology in the bundled template and isolate placeholder expansion in one helper.