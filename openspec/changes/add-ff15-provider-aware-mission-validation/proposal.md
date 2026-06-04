## Why

The provider-aware mission redesign now spans mission persistence, provider adapter resolution, Mission Workbench capability projection, and operation workflow delivery. Issue #63 locks that redesign in with focused validation so GitHub Copilot behavior stays preserved while OpenCode paths keep parity across the supported provider boundaries.

## What Changes

- Add focused validation for provider-aware mission persistence and provider adapter resolution.
- Add focused validation for roster Continue and model-change flows across GitHub Copilot and OpenCode missions.
- Add focused validation for Mission Workbench capability projection and operation workflow delivery through mission provider adapters.
- Keep the validation slice aligned with the boundaries introduced in issues #59, #60, #61, and #62 instead of adding a new broad integration suite.

## Capabilities

### New Capabilities
- `ff15-provider-aware-mission-validation`: Focused provider-aware mission validation across mission persistence, roster actions, workbench capability projection, and operation workflow delivery.

### Modified Capabilities

## Impact

- Affected code: `src/features/ff15-missions/state.test.ts`, `src/features/ff15-missions/agent-actions.test.ts`, `src/features/ff15-missions/workbench-controller.test.ts`, `src/features/ff15-missions/controller.test.ts`, and `src/features/ff15-operations/runtime-probe.test.ts`.
- Affected systems: provider-aware mission runtime coverage for GitHub Copilot and OpenCode, plus regression protection for the Mission Workbench and operation workflow delivery boundaries.
- No new dependencies or runtime behavior changes are required; this slice is validation-focused.