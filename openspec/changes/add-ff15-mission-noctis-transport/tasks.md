## 1. File-backed mission runtime

- [x] 1.1 Persist mission runtime records under `.ff15/missions/<missionId>/mission.json` while keeping active selection hydration compatible with the existing sidebar state
- [x] 1.2 Extend mission runtime records with deterministic session names, per-agent pane bindings, and user-facing transport failure state

## 2. Zellij mission transport

- [x] 2.1 Reconcile mission-scoped pane bindings through `list-panes --json` and create a Noctis pane when the mission session does not already expose one
- [x] 2.2 Deliver prompts with `write-chars`, wait a short interaction delay, and then submit `Enter` with `send-keys`

## 3. Provider and verification

- [x] 3.1 Wire the Missions provider and route to surface the updated file-backed runtime state and transport failures in the sidebar UI
- [x] 3.2 Add focused tests for `.ff15` persistence, pane binding reconciliation, and prompt delivery sequencing, then run the repository validation commands