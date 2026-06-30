---
paths:
  - "src/**"
---
# Extension Host Rules

## Feature structure
Each feature lives in its own subdirectory under `src/features/`. A feature owns its webview provider, commands, and types — do not cross-import between feature directories directly; route through `src/lib/` if sharing logic.

## VS Code API patterns
- Register disposables via `context.subscriptions.push(...)` — never leave listeners unregistered.
- Use `vscode.window.createWebviewPanel` / `WebviewViewProvider` for views; do not create raw HTML outside webview providers.
- Webview ↔ extension messaging: always type both sides with a discriminated-union `message` interface defined in `src/types/`.

## Terminal / Zellij
- Terminal launch logic lives in `src/features/ff15-launch/`. Do not spawn child processes from webview providers — route through the launch feature.
- All `cross-spawn` / `child_process` calls must handle `error` and `close` events.
