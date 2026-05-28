## ADDED Requirements

### Requirement: Operation-backed missions SHALL recover canonical runtime state after reload
The extension SHALL restore operation-backed mission identity from the canonical mission runtime under `.ff15` after VS Code reloads or mission re-selection.

#### Scenario: Hydrated mission restores operation metadata
- **WHEN** the extension hydrates an operation-backed mission from `.ff15/missions/<missionId>/mission.json`
- **THEN** the restored mission includes the saved operation reference, workflow step/task state, probe metadata, session metadata, and bridge-related mission metadata needed to continue the mission

### Requirement: Mission Workbench SHALL rebuild runtime bridge availability for hydrated missions
Reopening the Mission Workbench for a hydrated operation-backed mission SHALL restore loopback bridge availability when the current extension process no longer has an in-memory runtime for that workspace.

#### Scenario: Workbench reopen restores bridge readiness after reload
- **WHEN** an operation-backed mission is reopened after extension reload and the mission workflow was previously marked ready
- **THEN** the extension recreates the workspace runtime bridge assets and restores runtime readiness without requiring the user to recreate the mission

### Requirement: Recovered missions SHALL preserve workflow continuation state
Recovered operation-backed missions SHALL preserve enough workflow identity for the user to continue the mission after reload or re-selection.

#### Scenario: Workbench reopen preserves active workflow step
- **WHEN** the Mission Workbench reopens a saved operation-backed mission that already has an active workflow step
- **THEN** the workbench state preserves the saved operation reference, active step, active task, and continuation metadata instead of resetting the mission to a new workflow identity