## Why

`multi-agent-ff15-vscode` currently orchestrates FF15 missions through external terminals, but it cannot display the OpenCode chat UI inside VS Code. The sibling `opencode-chat` extension already provides this capability as a standalone extension. Port that functionality into `multi-agent-ff15-vscode` so users can open and operate OpenCode directly from a VS Code sidebar without installing a second extension.

## What Changes

- Add a new activity-bar container "OpenCode" with a "Chat" webview view.
- Port the OpenCode server lifecycle management from `opencode-chat`:
  - Spawn `opencode serve` on activation.
  - Reuse an existing server when one is already running.
  - Provide a restart command.
- Port the local webview proxy that injects clipboard/audio/link patches into the OpenCode HTML response.
- Port the loading, iframe, and error HTML templates as embedded TypeScript strings.
- Add "OpenCode: Add to Chat" and "OpenCode: Add Selection to Chat" commands with explorer/editor context menus.
- Add settings `multi-agent-ff15-vscode.openCode.port`, `.path`, and `.exposeToNetwork`.
- Add minimal vitest tests for the ported view provider and selection-to-reference conversion.
- Add runtime dependencies `cross-spawn` and `tree-kill`.

## Capabilities

### New Capabilities

- `opencode-chat-view`: Display the OpenCode web UI inside a VS Code webview view and manage its lifecycle.
- `opencode-server-lifecycle`: Start, reuse, restart, and stop the `opencode serve` process from within the extension.
- `opencode-webview-proxy`: Proxy OpenCode server traffic to inject webview compatibility patches for clipboard, keyboard shortcuts, audio, and external links.
- `opencode-chat-commands`: Provide VS Code commands and context menus to add files or selected code references to the OpenCode chat prompt.

### Modified Capabilities

- None.

## Impact

- `package.json`: new views container, view, commands, menus, configuration, and dependencies.
- `src/extension.ts`: register OpenCode provider/commands and start the server, isolated from existing FF15 activation so failures do not break current features.
- `src/config/extension-ids.ts`: new command/view IDs.
- `src/features/opencode-chat/`: new feature folder containing provider, server manager, proxy, and templates.
- `src/extension.test.ts`: updated to account for additional registrations.
