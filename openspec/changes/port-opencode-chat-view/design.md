## Context

`opencode-chat` is a standalone VS Code extension that embeds the OpenCode web UI in a sidebar webview. It manages the `opencode serve` process, proxies the server through a local HTTP proxy to inject webview compatibility patches, and exposes commands to add files or selections to the chat. `multi-agent-ff15-vscode` already depends on `opencode` for its FF15 mission flows, but it has no embedded chat UI. This change ports the `opencode-chat` capability into `multi-agent-ff15-vscode` as a first step before later customization.

## Goals / Non-Goals

**Goals:**

- Reproduce the full `opencode-chat` user experience inside `multi-agent-ff15-vscode`.
- Add an independent "OpenCode" activity-bar container with a "Chat" webview view.
- Start `opencode serve` on extension activation, reuse an existing server when possible, and allow restart.
- Preserve clipboard, keyboard shortcut, audio, and external-link behavior through the webview proxy.
- Provide "Add to Chat" context-menu commands for files and editor selections.
- Keep OpenCode initialization isolated so failures do not break existing FF15 views.
- Follow the existing `multi-agent-ff15-vscode` project conventions: feature folders, `extension-ids.ts`, vitest tests, and esbuild bundling.

**Non-Goals:**

- Changing the OpenCode web UI itself.
- Merging the chat view into the existing FF15 activity-bar container.
- Adding new keyboard shortcuts or command-palette-only commands beyond what `opencode-chat` provides.
- Refactoring the proxy script for configurability in this change.

## Decisions

1. **Separate activity-bar container**
   - *Choice:* Add a new `multi-agent-ff15-vscode.openCodeSidebar` container instead of placing the chat inside the existing FF15 container.
   - *Rationale:* This mirrors `opencode-chat`'s sidebar experience and keeps the OpenCode surface distinct from FF15 mission orchestration.

2. **Namespace under `multi-agent-ff15-vscode.openCode`**
   - *Choice:* Commands and settings use IDs like `multi-agent-ff15-vscode.openCode.addToChat` and `multi-agent-ff15-vscode.openCode.port`.
   - *Rationale:* Avoids conflicts with the original `opencode-chat` extension when both are installed.

3. **Embed HTML templates as TypeScript strings**
   - *Choice:* Convert `loading.html`, `iframe.html`, and `error.html` into exported template strings instead of copying files to `dist/`.
   - *Rationale:* `multi-agent-ff15-vscode` bundles the extension with esbuild into a single `dist/extension.js`; embedded strings keep the build simple and match the bundling model.

4. **Keep `cross-spawn` and `tree-kill`**
   - *Choice:* Port the process management dependencies unchanged.
   - *Rationale:* They handle cross-platform spawning and reliable process-tree termination; re-implementing with Node built-ins risks regressions on Windows.

5. **Isolate OpenCode initialization in `extension.ts`**
   - *Choice:* Wrap OpenCode registration and server startup in a dedicated `try/catch` rather than surrounding the whole `activate` function.
   - *Rationale:* Prevents an OpenCode-specific failure from disabling the existing FF15 Projects/Missions/Settings views.

6. **Minimal tests aligned with existing style**
   - *Choice:* Add vitest tests for the view provider state transitions and for the selection-to-reference string conversion.
   - *Rationale:* The project already uses vitest; these are the highest-value, lowest-coupling test points. Server process tests are omitted because they require heavy mocking.

## Risks / Trade-offs

- **[Risk]** The large inline proxy script is duplicated as-is, making future customization harder. → *Mitigation:* The script is intentionally left intact for "as-is" porting; future changes can extract it.
- **[Risk]** Starting `opencode serve` on every activation may spawn a process even when the user only wants FF15 features. → *Mitigation:* This matches `opencode-chat` behavior; a future lazy-start option can be added without breaking the API.
- **[Risk]** `tree-kill` has no TypeScript declarations. → *Mitigation:* Provide a small module declaration file (`src/types/tree-kill.d.ts`).
