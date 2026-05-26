## ADDED Requirements

### Requirement: Mission continuation metadata survives extension reloads
The system SHALL persist the session-scoped metadata required to continue a stored mission from the Missions view after the extension reloads.

#### Scenario: Rehydrate a stored mission after reload
- **WHEN** the extension reloads and restores missions from `.ff15/missions/<missionId>/mission.json`
- **THEN** each restored mission includes the persisted session metadata needed to target its existing Noctis pane for a follow-up send

### Requirement: Existing missions reuse their stored Noctis session
The system SHALL send follow-up prompts for a selected stored mission through that mission's existing Zellij session and Noctis pane instead of creating a replacement mission session.

#### Scenario: Continue an existing mission conversation
- **WHEN** the user selects a stored mission that still resolves a live Noctis pane and submits another prompt
- **THEN** the extension sends the prompt to the stored mission-scoped Noctis pane without creating a new mission session

### Requirement: Missing Noctis panes fail with a recoverable mission error
The system SHALL block existing-mission sends with a recoverable user-facing error when the stored mission session can no longer resolve a live Noctis pane.

#### Scenario: Stored session no longer resolves a live Noctis pane
- **WHEN** the user submits a follow-up prompt for a stored mission whose persisted session metadata no longer matches a live Noctis pane
- **THEN** the extension does not create a replacement mission session and marks the mission with a recoverable error state