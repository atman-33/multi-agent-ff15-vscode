## 1. Setup

- [x] 1.1 Add `cross-spawn`, `tree-kill`, and `@types/cross-spawn` to `package.json` dependencies.
- [x] 1.2 Declare a TypeScript module declaration for `tree-kill` so it imports cleanly.

## 2. Configuration and IDs

- [x] 2.1 Add OpenCode command/view/settings IDs to `src/config/extension-ids.ts`.
- [x] 2.2 Update `package.json` contributes section with the new activity-bar container, Chat view, commands, menus, and OpenCode settings.

## 3. Core OpenCode Feature

- [x] 3.1 Create `src/features/opencode-chat/templates.ts` with embedded loading, iframe, and error HTML templates.
- [x] 3.2 Create `src/features/opencode-chat/WebviewProxy.ts` by porting the proxy and its injected compatibility script.
- [x] 3.3 Create `src/features/opencode-chat/ServerManager.ts` by porting the server lifecycle management.
- [x] 3.4 Create `src/features/opencode-chat/OpencodeViewProvider.ts` by porting the view provider to use embedded templates.

## 4. Extension Integration

- [x] 4.1 Update `src/extension.ts` to register the OpenCode view provider and commands inside an isolated `try/catch`.
- [x] 4.2 Start the OpenCode server on activation with settings from `multi-agent-ff15-vscode.openCode.*`.
- [x] 4.3 Implement the four OpenCode commands and wire context menus.

## 5. Tests

- [x] 5.1 Create `src/features/opencode-chat/OpencodeViewProvider.test.ts` covering loading, server URL, error, and `addToChat` states.
- [x] 5.2 Create `src/features/opencode-chat/selection-reference.test.ts` covering cursor-only, single-line, and multi-line selection reference formats.
- [x] 5.3 Update `src/extension.test.ts` to account for the additional OpenCode registrations.

## 6. Validation

- [x] 6.1 Run `npm install` to fetch new dependencies.
- [x] 6.2 Run `npm run compile` to verify the extension bundles successfully.
- [x] 6.3 Run `npm run test` to verify all tests pass.
- [x] 6.4 Run `npm run check` (or lint/format) to ensure style compliance.
