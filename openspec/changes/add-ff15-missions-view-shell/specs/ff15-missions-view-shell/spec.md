## ADDED Requirements

### Requirement: FF15 sidebar exposes a dedicated Missions view
The extension SHALL contribute a Missions view inside the FF15 activity bar container as a separate sidebar surface from Launch and Settings.

#### Scenario: FF15 sidebar shows missions separately
- **WHEN** the extension activates and the user opens the FF15 activity bar container
- **THEN** the sidebar shows Launch, Missions, and Settings as distinct FF15 views

#### Scenario: Missions view uses FF15-specific content
- **WHEN** the user opens the Missions view
- **THEN** the view renders an FF15 missions workspace shell instead of a boilerplate sample route

### Requirement: Missions view manages lightweight mission records
The Missions view SHALL let the user create and select lightweight mission records that persist through extension reloads for the current workspace.

#### Scenario: User creates the first mission
- **WHEN** the user creates a mission from the Missions view
- **THEN** the extension stores a lightweight mission record and shows it in the mission list as the active mission

#### Scenario: User switches between missions
- **WHEN** the user selects a different mission from the Missions list
- **THEN** the extension updates the active mission and the view reflects that selection

#### Scenario: Mission state restores after reload
- **WHEN** the extension reloads in the same workspace after missions were created
- **THEN** the Missions view restores the stored mission records and the last active mission selection

### Requirement: Missions view provides a Noctis composer shell before transport is implemented
The Missions view SHALL render a Noctis composer shell for the active mission and SHALL present clear empty or disabled states when no mission is selected.

#### Scenario: No mission is selected
- **WHEN** the user opens the Missions view with no active mission
- **THEN** the composer shell is disabled and the view explains that the user must create or select a mission first

#### Scenario: Active mission is selected
- **WHEN** the user selects or creates a mission
- **THEN** the Missions view shows a Noctis composer shell bound to that mission context