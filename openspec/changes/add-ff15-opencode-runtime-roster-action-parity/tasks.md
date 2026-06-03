## 1. Adapter and controller updates

- [x] 1.1 Extend the mission provider adapter so OpenCode roster actions can expose provider-specific Continue and model-change behavior without catalog-parity gating.
- [x] 1.2 Update mission agent actions and Mission Workbench message handling to use adapter-owned roster-action support instead of empty-catalog checks.

## 2. Validation

- [x] 2.1 Add focused regression tests for OpenCode and GitHub Copilot roster Continue/model-change flows in `agent-actions.test.ts` and `workbench-controller.test.ts`.
- [x] 2.2 Run focused mission tests, then root `npm run lint`, `npm run test`, and `npm run compile`.