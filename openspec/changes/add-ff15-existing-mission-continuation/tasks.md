## 1. Mission rehydration

- [x] 1.1 Extend the file-backed mission runtime shape so restored missions retain the session metadata needed for existing-mission continuation after reload.
- [x] 1.2 Rehydrate the Missions controller and provider from persisted mission runtime data so restored missions keep their continuation state and selected mission context.

## 2. Existing-mission send path

- [x] 2.1 Update the mission send controller to reuse the stored mission-scoped Zellij session and Noctis pane for follow-up prompts.
- [x] 2.2 Block continuation with a recoverable mission error when the stored mission can no longer resolve a live Noctis pane.

## 3. Verification

- [x] 3.1 Add focused tests for reload rehydration, existing-mission send behavior, and stale-pane recovery.
- [x] 3.2 Run the repository validation commands for the touched slice and the repo defaults.