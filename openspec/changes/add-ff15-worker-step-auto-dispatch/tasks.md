## 1. Shared transport wiring

- [x] 1.1 Reuse a shared mission transport instance so runtime-driven worker dispatch can target live mission panes
- [x] 1.2 Extend operation and runtime metadata with the minimal worker dispatch context needed after an accepted report transition

## 2. Worker handoff loop

- [x] 2.1 Detect worker-owned next steps after accepted report transitions and deliver a step-specific prompt to the correct worker pane
- [x] 2.2 Persist worker dispatch success or actionable failure on the canonical mission record for Workbench projection

## 3. Verification

- [x] 3.1 Add focused tests for accepted-report to worker-prompt dispatch and dispatch failure handling
- [x] 3.2 Run repository validation commands: `npm run lint`, `npm run test`, and `npm run compile`