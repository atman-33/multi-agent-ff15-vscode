## 1. Workbench controller conflict orchestration

- [x] 1.1 Add Projects config/profile watching to the workbench controller using the resolved harness source path.
- [x] 1.2 Track the last accepted snapshot, pending local draft, queued external snapshot, and conflict-resolution actions in the controller.
- [x] 1.3 Auto-refresh the Projects editor on external changes when no local draft is pending.

## 2. Projects workbench conflict UI

- [x] 2.1 Add webview message handling and UI state for external-change conflict prompts.
- [x] 2.2 Implement explicit `reload`, `discard-local`, and `keep-local` actions and reflect the resulting status back into the editor.

## 3. Focused tests and repository checks

- [x] 3.1 Add focused workbench-controller tests for watcher-driven refresh plus each conflict branch.
- [x] 3.2 Run focused Projects tests, then `npm run lint`, `npm run test`, and `npm run compile`.