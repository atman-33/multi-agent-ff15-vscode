## Why

FF15 Mission Workbench roster actions already flow through the shared mission provider adapter, but the current adapter contract still assumes GitHub Copilot style model selection. That leaves OpenCode missions unable to continue a live pane conversation or change an agent model from the roster even though the runtime already supports provider-specific command delivery.

## What Changes

- Extend the mission provider adapter so roster actions can emit provider-specific Continue and model-change input sequences for live panes.
- Allow OpenCode missions to use roster-driven in-session model changes without requiring a GitHub Copilot style selectable mission catalog contract.
- Keep GitHub Copilot roster actions on the same shared adapter path and add focused regression tests for both providers.

## Capabilities

### New Capabilities
- `ff15-opencode-runtime-roster-actions`: Provide provider-parity live-pane Continue and model-change roster actions for OpenCode missions through the shared mission provider adapter.

### Modified Capabilities

## Impact

- Affected code: `src/features/ff15-missions/mission-provider-adapter.ts`, `src/features/ff15-missions/agent-actions.ts`, `src/features/ff15-missions/workbench-controller.ts`, and focused mission tests.
- Affected systems: Mission Workbench party roster action dispatch, provider-owned model selection persistence, and provider-sensitive live-pane command delivery.
- No new external dependencies or provider-state schema redesign are required in this slice.