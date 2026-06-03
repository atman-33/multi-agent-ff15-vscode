## 1. Adapter Contract

- [ ] 1.1 Define a mission provider adapter contract and registry keyed by mission `providerId`.
- [ ] 1.2 Implement provider adapters for GitHub Copilot CLI and OpenCode using the current mission behavior.

## 2. Mission Controller Refactor

- [ ] 2.1 Update mission session and VS Code controller flows to resolve launch/runtime behavior through the provider adapter.
- [ ] 2.2 Update agent actions and Mission Workbench projection to resolve continue/model-change commands, model catalog access, and capability flags through the provider adapter.

## 3. Validation

- [ ] 3.1 Add focused tests for provider adapter resolution across agent actions, workbench controller, session controller, and VS Code controller slices.
- [ ] 3.2 Run repository validation with focused mission tests plus root `npm run lint`, `npm run test`, and `npm run compile`.