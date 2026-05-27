## ADDED Requirements

### Requirement: Missions list opens a dedicated Mission Workbench in the editor area
The extension SHALL open or focus a dedicated Mission Workbench in the editor area when the user creates a mission or selects an existing mission from the Missions list.

#### Scenario: Creating a mission opens its workbench
- **WHEN** the user creates a new mission from the Missions sidebar
- **THEN** the extension creates the mission, keeps it selected, and opens a Mission Workbench for that mission in the editor area

#### Scenario: Selecting an existing mission focuses its workbench
- **WHEN** the user selects an existing mission from the Missions sidebar
- **THEN** the extension opens or focuses the Mission Workbench for that mission instead of requiring the user to work entirely inside the sidebar

### Requirement: Mission Workbench is the primary operation-entry surface
The Mission Workbench SHALL show the selected mission context, mission status, terminal reopen affordance, and operation picker so the user can manage operation entry in a full-width editor surface.

#### Scenario: Workbench shows mission context and controls
- **WHEN** the Mission Workbench opens for a mission
- **THEN** it shows the mission identity, the current mission status, a way to reopen the mission terminal, and the available operations catalog for that mission

#### Scenario: Missions sidebar remains a navigator
- **WHEN** the user returns to the Missions sidebar after the Mission Workbench exists
- **THEN** the sidebar presents mission list and status navigation rather than duplicating the full workbench interaction surface

### Requirement: Mission selection persists the selected operationRef
The extension SHALL persist the selected `operationRef` on the canonical mission runtime record for each mission.

#### Scenario: Selecting a supported operation updates mission runtime
- **WHEN** the user selects a supported operation from the Mission Workbench catalog
- **THEN** the extension writes that mission's selected `operationRef` to the canonical mission runtime record and updates the workbench state to match

#### Scenario: Reopening a mission restores the selected operation
- **WHEN** the user reopens a mission whose runtime record already contains a selected `operationRef`
- **THEN** the Mission Workbench restores that selected operation for the mission instead of resetting the operation picker