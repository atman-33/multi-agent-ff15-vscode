## Why

FF15 mission controllers still embed provider-specific branching for GitHub Copilot CLI and OpenCode behavior. That keeps launch/runtime, roster actions, and model catalog access coupled to each controller instead of one provider-owned contract, which makes issue #57's provider-owned mission state harder to extend and makes future providers expensive to add.

## What Changes

- Introduce a mission provider adapter contract that mission/runtime flows resolve from a shared registry.
- Move provider-specific behavior for mission session launch/reopen, continue actions, model changes, and model catalog access behind provider adapter implementations.
- Expose provider capability flags through the adapter so Mission Workbench and runtime controllers can project supported behavior without direct provider branches.
- Add focused regression coverage for the touched mission controller slices and adapter resolution.

## Capabilities

### New Capabilities
- `ff15-mission-provider-adapter-layer`: Resolve FF15 mission provider behavior through an adapter registry instead of controller-owned provider conditionals.

### Modified Capabilities

## Impact

- Affected code: `src/features/ff15-missions/agent-actions.ts`, `src/features/ff15-missions/workbench-controller.ts`, `src/features/ff15-missions/vscode-controller.ts`, `src/features/ff15-missions/session-controller.ts`, `src/features/ff15-missions/model-contract.ts`, and focused mission tests.
- Affected systems: Mission Workbench roster/model projection, provider-aware mission runtime behavior, and provider-owned mission state resolution.
- No new external dependencies or expanded OpenCode model-catalog UI scope are introduced in this slice.