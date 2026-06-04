## 1. Adapter delivery contract

- [x] 1.1 Extend the mission provider adapter contract with operation workflow prompt delivery for activation and follow-up dispatch.
- [x] 1.2 Update provider implementations to own pane resolution and prompt send behavior for operation workflow steps.

## 2. Controller and runtime integration

- [x] 2.1 Route operation-backed mission activation in `controller.ts` through the pinned mission provider adapter.
- [x] 2.2 Route runtime follow-up dispatch in `runtime-probe.ts` through the same adapter contract while keeping prompt composition provider-neutral.

## 3. Validation

- [x] 3.1 Add focused tests for provider-adapter-backed activation delivery and runtime follow-up dispatch.
- [x] 3.2 Run focused mission/runtime tests, then root `npm run lint`, `npm run test`, and `npm run compile`.