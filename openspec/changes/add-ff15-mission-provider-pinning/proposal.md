## Why

FF15 missions currently resolve their runtime provider from the live workspace launch-client setting each time an action runs. That breaks mission continuity, because changing the global setting after mission creation silently changes how an existing mission launches, reopens, and sends prompts.

## What Changes

- Persist a fixed FF15 provider identifier on each mission record when the mission is created.
- Capture the mission provider from the current workspace launch-client setting once at mission creation time.
- Resolve mission launch, reopen, and prompt-send behavior from the mission-owned provider instead of the latest workspace setting.
- Add focused regression coverage for mission creation pinning and mission-owned provider resolution.

## Capabilities

### New Capabilities
- `ff15-mission-provider-pinning`: Pin a mission to the launch provider selected at creation time and keep later mission runtime actions on that provider.

### Modified Capabilities

## Impact

- Affected code: `src/features/ff15-missions/state.ts`, `src/features/ff15-missions/controller.ts`, `src/features/ff15-missions/session-controller.ts`, `src/features/ff15-missions/vscode-controller.ts`, and focused mission tests.
- Affected systems: mission persistence, VS Code mission controller wiring, and mission runtime launch/send flows.
- No new external dependencies or user-facing provider picker UI are introduced in this slice.