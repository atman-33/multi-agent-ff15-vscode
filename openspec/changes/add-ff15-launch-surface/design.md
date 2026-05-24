## Context

The current extension is still a boilerplate project. It registers sample commands, exposes two sample webview views, and has no FF15-specific launch path. Issue #2 introduces the first vertical slice: replace the sample entry point with a minimal FF15 launch surface and wire that surface to a Zellij launch flow that runs inside VS Code.

This slice intentionally stops before richer session management. The 2x2 FF15 layout and attach-or-create reuse model belong to follow-up issues. Even so, this slice crosses multiple modules: package manifest contributions, extension activation, sidebar/webview messaging, launch orchestration, dependency checks, and extension-side tests.

The user wants the active VS Code workspace root to be used as the launch target, no dependency on the sibling multi-agent-ff15 repository, and no path settings for `zellij` or `opencode` in v1.

## Goals / Non-Goals

**Goals:**
- Replace the current sample sidebar experience with a minimal FF15 launch surface.
- Expose a single launch action that starts from the active VS Code workspace root.
- Validate `zellij` and `opencode` before launch and fail with a clear user-facing message when either dependency is unavailable.
- Open Zellij inside VS Code's terminal experience.
- Isolate launch logic into extension-side modules that can support later session management enhancements.
- Add unit tests for dependency validation and launch orchestration.

**Non-Goals:**
- Implement the fixed 2x2 four-agent layout.
- Implement attach-or-create session reuse.
- Add stop, status, or focus commands.
- Add configurable binary paths.
- Add a complex dashboard or status UI.

## Decisions

### 1. Replace the sample views with a single FF15 launch view

The existing `SimpleView` and `InteractiveView` are boilerplate. This change will consolidate the sidebar into one FF15-specific view with a single primary launch action.

- Chosen because issue #2 is about creating one obvious entry point, not preserving playground functionality.
- Alternative considered: keep the sample view and add an FF15 command in the command palette. Rejected because it leaves the sidebar in an obviously placeholder state.

### 2. Keep launch orchestration in a dedicated extension-side controller

The provider should only translate webview messages into extension actions. Dependency checks, workspace resolution, and terminal launch should live in a separate controller/service layer.

- Chosen because later issues will extend the same launch path with layout generation and session reuse.
- Alternative considered: place all launch logic directly in the webview provider. Rejected because it would mix messaging with orchestration and make future changes brittle.

### 3. Resolve the target root from the current VS Code workspace context

The launch flow will derive a target root from the current VS Code window. When there is an active editor inside a workspace folder, that folder should win. Otherwise, the first workspace folder in the window should be used.

- Chosen because it gives a deterministic interpretation of “active workspace root” without introducing a selector UI.
- Alternative considered: always use the first workspace folder. Rejected because it behaves poorly when the user is actively working in another folder of a multi-root workspace.

### 4. Validate dependencies by executing lightweight version checks before launch

Before opening the terminal, the controller should verify that both `zellij` and `opencode` are executable by running a lightweight version or help command from Node child processes.

- Chosen because it validates that the binaries are actually runnable, not just discoverable in PATH.
- Alternative considered: rely on terminal launch failure alone. Rejected because it produces a worse user experience and weaker testable behavior.
- Alternative considered: resolve executables via platform-specific commands such as `where.exe`. Rejected because process execution checks are more portable for later WSL work.

### 5. Launch Zellij in a VS Code terminal by creating a terminal at the target cwd and sending the `zellij` command

For this slice, the extension should open a regular VS Code terminal rooted at the resolved workspace and send the `zellij` command into it.

- Chosen because it preserves PATH-based executable resolution and keeps the launch flow simple for v1.
- Alternative considered: use `shellPath: "zellij"` directly when creating the terminal. Rejected because the plain terminal-plus-command approach is easier to keep compatible with later command variations.
- Alternative considered: spawn Zellij entirely outside the VS Code terminal subsystem. Rejected because the user explicitly wants the experience to stay inside VS Code.

## Risks / Trade-offs

- [Active workspace resolution in multi-root windows may still surprise users] → Use the active editor's workspace folder when available and otherwise fall back deterministically to the first folder.
- [The launch view will be intentionally minimal and may feel incomplete] → Keep the scope narrow in this slice and add richer session features in follow-up issues rather than overloading the first change.
- [Dependency validation adds extra subprocess calls before launch] → Use lightweight commands and isolate them in a testable checker so the behavior is explicit and cheap.
- [Launching plain `zellij` does not yet deliver the final FF15 layout] → Document the missing layout behavior as a deliberate non-goal for this issue and cover it in the next slice.