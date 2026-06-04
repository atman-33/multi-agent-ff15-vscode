## ADDED Requirements

### Requirement: Provider-aware mission persistence and adapter resolution stay covered
The system SHALL keep focused regression coverage for mission provider persistence and provider adapter resolution across supported mission providers.

#### Scenario: Mission state keeps provider-owned mission data
- **WHEN** mission state reads or updates a provider-aware mission record
- **THEN** focused tests cover provider-owned mission data without collapsing it back into provider-agnostic fields

#### Scenario: Mission controller resolves the pinned provider adapter
- **WHEN** a focused mission send path runs for a mission pinned to a supported provider
- **THEN** tests verify the controller resolves the mission's pinned provider adapter before provider-owned delivery occurs

### Requirement: Roster actions preserve GitHub Copilot behavior and OpenCode parity
The system SHALL keep focused validation for Continue and model-change roster actions across GitHub Copilot and OpenCode missions.

#### Scenario: Continue action runs on a supported provider mission
- **WHEN** the user triggers Continue for a mission pinned to GitHub Copilot or OpenCode
- **THEN** focused tests verify the provider-aware action path dispatches the correct input sequence for that provider

#### Scenario: Model change runs on a supported provider mission
- **WHEN** the user changes an agent model for a mission pinned to GitHub Copilot or OpenCode
- **THEN** focused tests verify provider-specific availability and input behavior for that mission provider

### Requirement: Workbench and operation workflow validation cover provider-owned boundaries
The system SHALL keep focused validation for Mission Workbench capability projection and operation workflow delivery through mission provider adapters.

#### Scenario: Mission Workbench opens a provider-pinned mission
- **WHEN** the Mission Workbench builds state for a supported provider-pinned mission
- **THEN** focused tests verify the payload includes provider-derived capability state for that mission provider

#### Scenario: Operation workflow delivery dispatches through the pinned provider adapter
- **WHEN** operation-backed mission activation or runtime follow-up delivery occurs for a supported provider-pinned mission
- **THEN** focused tests verify the provider-owned adapter boundary handles prompt delivery for that mission provider