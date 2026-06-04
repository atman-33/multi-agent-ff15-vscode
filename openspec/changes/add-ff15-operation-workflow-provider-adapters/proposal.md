## Why

Operation-backed missions already build provider-neutral FF15 prompts, but the activation send path and runtime follow-up dispatch still bypass the mission provider adapter and talk to mission transport directly. That leaves workflow execution biased toward the current provider assumptions and blocks OpenCode-backed missions from using the same workflow loop through their provider-owned runtime behavior.

## What Changes

- Route operation activation prompt delivery through the pinned mission provider adapter instead of controller-owned transport assumptions.
- Route runtime follow-up step dispatch through the same provider adapter contract so worker and Noctis handoffs reuse provider-owned delivery behavior.
- Keep operation prompt composition provider-neutral while moving pane resolution and send semantics behind adapter implementations.
- Add focused regression coverage for mission send and runtime follow-up dispatch behavior.

## Capabilities

### New Capabilities
- `ff15-operation-workflow-provider-adapters`: Mission-scoped operation workflow delivery resolves from the pinned provider adapter for both initial activation and runtime follow-up dispatch.

### Modified Capabilities

## Impact

- Affected code: `src/features/ff15-missions/mission-provider-adapter.ts`, `src/features/ff15-missions/controller.ts`, `src/features/ff15-operations/runtime-probe.ts`, and their focused tests.
- Affected systems: operation-backed mission activation, runtime step handoff delivery, and mission provider runtime behavior.
- No new external dependencies or changes to the provider-neutral operation prompt schema are introduced in this slice.