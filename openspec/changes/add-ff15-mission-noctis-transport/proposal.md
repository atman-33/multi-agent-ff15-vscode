## Why

The Missions view now lets the user create and select missions, but the first Noctis prompt still stops at a disabled shell with no live transport. Issue #13 is needed now so the first mission prompt can launch or attach to a deterministic mission-scoped Zellij session, deliver the prompt to Noctis, and turn the mission shell into a real end-to-end path.

## What Changes

- Add a workspace-local FF15 runtime store under `.ff15/` so each mission persists its transport metadata in a visible, file-backed location instead of relying only on VS Code-managed storage.
- Add an extension-side mission transport/controller flow that launches or attaches to a deterministic mission-scoped Zellij session rooted at the current workspace and records the resolved session plus agent-to-pane mapping for that mission.
- Resolve the Noctis pane for that mission session through Zellij's external control surface and deliver the prompt with `write-chars`, a short interaction delay, and `send-keys Enter` rather than a VS Code terminal handle.
- Extend mission state and Missions view messaging so successful delivery marks the mission active, runtime metadata is persisted for later sends, and transport failures surface a user-facing error.
- Add focused tests for controller and transport orchestration around launch, pane lookup, prompt delivery, and failure handling.

## Capabilities

### New Capabilities
- `ff15-mission-noctis-transport`: Launch or attach a mission-scoped Noctis session from the Missions view, deliver prompts through Zellij control commands, and surface mission transport state to the user.

### Modified Capabilities
- None.

## Impact

- Affected extension-host code includes new mission transport/controller modules plus updates to mission state, provider handling, workspace-root resolution, and `.ff15` runtime persistence.
- Affected UI code includes Missions view send handling and user-facing error or busy state updates.
- Affected workspace runtime data includes `.ff15/missions/<missionId>/mission.json` records that store mission status, Zellij session name, and agent pane mappings.
- Affected tests include focused unit coverage for transport orchestration, `.ff15` persistence, mission state transitions, provider messaging, and failure cases.