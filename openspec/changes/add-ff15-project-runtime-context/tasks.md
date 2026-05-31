## 1. Runtime-context contract

- [ ] 1.1 Add a shared runtime-context resolver that combines the first-workspace-folder execution root with resolved Projects OpenSpec context.
- [ ] 1.2 Add focused tests for project-mode and harness-mode runtime-context resolution semantics.

## 2. Launch and mission propagation

- [ ] 2.1 Update Launch and mission session orchestration to consume the shared execution root instead of treating the raw workspace root as the only runtime context.
- [ ] 2.2 Extend focused launch/mission tests to prove the derived runtime context is propagated through launch cwd and mission session setup.

## 3. Operation prompt tooling context

- [ ] 3.1 Extend operation-aware prompt composition inputs to carry `openspec_root` separately from execution-root placeholders.
- [ ] 3.2 Add focused prompt-composition tests for `project` and `harness` OpenSpec path propagation, then run `npm run lint`, `npm run test`, and `npm run compile`.