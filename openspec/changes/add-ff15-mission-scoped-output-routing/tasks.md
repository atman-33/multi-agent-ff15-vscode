## 1. Mission runtime output paths

- [x] 1.1 Add a shared helper that resolves mission-scoped output paths under `.ff15/missions/<missionId>/outputs/<stepId>/<taskId>/<fileName>`
- [x] 1.2 Thread the helper through operation prompt composition inputs so both current-step guidance and prior-output resolution can use the same path contract

## 2. Prompt composition routing

- [x] 2.1 Update output-contract guidance to tell agents the exact mission-scoped file path for declared outputs
- [x] 2.2 Resolve `output(...)` placeholders from mission-scoped runtime artifacts for both Noctis and worker-owned prompts

## 3. Verification

- [x] 3.1 Update focused prompt-composition tests to assert mission-scoped output paths and reject workspace-root artifact routing
- [x] 3.2 Run repository validation with `npm run lint`, `npm run test`, and `npm run compile`