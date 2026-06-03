## Why

FF15 OpenCode missions still render roster model pickers from a hard-coded catalog, so the Mission Workbench can offer models that are not actually available in the local runtime and cannot reflect per-workspace availability changes. Issue #60 needs the extension to discover the local OpenCode catalog at runtime, cache it for the workspace, and degrade only the model-change controls when refresh fails.

## What Changes

- Add a workspace-scoped OpenCode model catalog refresh path based on `opencode models --verbose`.
- Cache the discovered OpenCode model snapshot for each workspace and expose the latest usable catalog to Mission Workbench state.
- Disable only the roster model-change controls with a visible reason when OpenCode catalog refresh fails, while keeping Continue actions available.
- Replace static OpenCode roster picker data with the discovered catalog and add focused regression tests around refresh, caching, and degraded workbench state.

## Capabilities

### New Capabilities
- `ff15-opencode-dynamic-model-catalog`: Discover, cache, and project the local OpenCode model catalog for Mission Workbench roster controls.

### Modified Capabilities

## Impact

- Affected code: `src/features/ff15-missions/model-contract.ts`, `src/features/ff15-missions/mission-provider-adapter.ts`, `src/features/ff15-missions/agent-actions.ts`, `src/features/ff15-missions/workbench-controller.ts`, `src/extension.ts`, and Mission Workbench webview/UI code.
- Affected systems: workspace-scoped OpenCode runtime integration, Mission Workbench party roster state, and provider-aware model-change validation.
- No new external dependencies are required; this slice reuses the local `opencode` CLI already expected by OpenCode missions.