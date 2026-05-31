## ADDED Requirements

### Requirement: Mission titles can be renamed after creation
The system SHALL allow the user to rename a mission after creation from the Mission Workbench and SHALL persist the updated title for later sidebar and workbench sessions.

#### Scenario: Rename a draft mission from the Mission Workbench
- **WHEN** the user updates the mission title in the Mission Workbench with a non-empty value
- **THEN** the extension persists that title and shows it as the mission title in both the Missions view snapshot and the Mission Workbench header

### Requirement: The first mission send can promote the prompt into the mission title
The system SHALL derive the mission title from the submitted prompt on the first mission send only when the mission still uses the default generated title.

#### Scenario: First send replaces the default mission title
- **WHEN** the user submits the first non-empty prompt for a mission whose title is still the generated default label
- **THEN** the extension stores a normalized, length-limited summary of that prompt as the mission title before the updated mission state is rendered again

### Requirement: Explicit mission titles remain authoritative
The system SHALL preserve manually chosen mission titles and SHALL NOT overwrite them during later prompt sends or when the first send occurs after an explicit rename.

#### Scenario: Manual rename wins over first-send auto-titling
- **WHEN** the user renames a mission before sending the first prompt and then sends a prompt to Noctis
- **THEN** the extension keeps the manually chosen mission title instead of replacing it with the submitted prompt text

### Requirement: Mission title changes do not alter mission runtime identity
The system SHALL treat mission title changes as presentation updates and SHALL keep the mission id and mission session association unchanged.

#### Scenario: Rename does not detach an active mission session
- **WHEN** the user renames a mission that already has a mission-scoped session association
- **THEN** the mission remains attached to the same mission runtime identity and can continue sending prompts through the existing mission context