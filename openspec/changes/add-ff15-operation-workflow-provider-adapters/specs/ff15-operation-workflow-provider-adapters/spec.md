## ADDED Requirements

### Requirement: Operation activation send uses mission provider adapter
The system SHALL resolve the pinned mission provider adapter before delivering an operation-backed mission activation prompt.

#### Scenario: Activation prompt delivery for an operation-backed mission
- **WHEN** a mission send request includes an operation workflow
- **THEN** the controller resolves the adapter for the mission's pinned provider before delivery
- **THEN** the controller hands the provider-neutral operation prompt to the adapter-owned delivery path

### Requirement: Runtime follow-up dispatch uses mission provider adapter
The system SHALL reuse the mission provider adapter when runtime transitions dispatch the next workflow step.

#### Scenario: Worker or Noctis follow-up dispatch after an accepted report
- **WHEN** the runtime accepts a report and determines that the next step should auto-dispatch
- **THEN** the runtime resolves the adapter for the mission's pinned provider
- **THEN** the runtime delivers the provider-neutral follow-up prompt through the adapter-owned delivery path instead of a controller-owned generic send path

### Requirement: Operation prompt composition stays provider-neutral
The system SHALL keep operation prompt composition outside provider adapters while limiting adapters to delivery/runtime differences.

#### Scenario: Provider-aware delivery with shared prompt format
- **WHEN** activation or runtime follow-up delivery occurs for an operation-backed mission
- **THEN** the prompt body uses the existing provider-neutral operation prompt builders
- **THEN** provider-specific pane resolution or send semantics remain encapsulated inside adapter implementations