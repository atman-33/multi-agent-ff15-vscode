## Why

The Mission Workbench already knows which provider a mission is pinned to, but the webview still receives only a generic roster state. That leaves the UI guessing when model controls should be shown or disabled, and some unavailable roster actions degrade into weak or missing feedback instead of a provider-specific reason.

## What Changes

- Add provider-aware capability state to the Mission Workbench payload alongside the pinned mission provider and provider-scoped model catalog state.
- Project explicit roster action availability reasons from the extension host so the webview can disable or hide unsupported controls without guessing.
- Update the party roster UI to gate model and continue actions from capability plus runtime state, and to surface explicit reasons when an action is unavailable.
- Add focused tests for provider-aware workbench projection, provider-specific roster rendering, and unavailable-action feedback.

## Capabilities

### New Capabilities
- `ff15-mission-workbench-provider-capabilities`: Provider-aware Mission Workbench payload and roster control gating for mission party actions.

### Modified Capabilities

## Impact

- Affected code: `src/features/ff15-missions/workbench-controller.ts`, `src/features/ff15-missions/mission-provider-adapter.ts`, `src/features/ff15-missions/agent-actions.ts`, related Mission Workbench tests, and `webview-ui/src/app/routes/ff15-mission-workbench/**`.
- Affected systems: Mission Workbench webview message contract, provider-aware roster interaction UX, and mission provider adapter projection.
- No new dependencies are required.