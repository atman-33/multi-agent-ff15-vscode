## ADDED Requirements

### Requirement: Mission Workbench posts provider-aware roster capability state
The system SHALL post the pinned mission provider and provider-aware party-roster capability state in the Mission Workbench payload.

#### Scenario: Workbench opens a GitHub Copilot mission
- **WHEN** the Mission Workbench builds state for a mission pinned to `github-copilot-cli`
- **THEN** the payload includes the mission provider id and the provider-derived roster capability state for that provider

#### Scenario: Workbench opens an OpenCode mission
- **WHEN** the Mission Workbench builds state for a mission pinned to `opencode`
- **THEN** the payload includes the mission provider id, the provider-derived roster capability state, and the provider-specific model catalog state for that provider

### Requirement: Party roster controls respect capability and runtime availability
The system SHALL enable, disable, or hide Mission Workbench party-roster controls from provider capability state plus mission runtime readiness instead of inferring support from catalog presence alone.

#### Scenario: Model selection is unavailable for the active provider state
- **WHEN** the workbench payload marks roster model selection as unavailable for the active mission provider
- **THEN** the party roster hides or disables the unsupported model control path and renders the explicit unavailable reason

#### Scenario: Mission terminal is not ready
- **WHEN** the mission terminal is not ready for party-roster actions
- **THEN** the party roster disables runtime-dependent actions and renders the explicit runtime reason

### Requirement: Unavailable roster actions surface explicit reasons
The system SHALL surface an explicit reason whenever a Mission Workbench provider or runtime state makes a roster action unavailable.

#### Scenario: Provider-specific model action is unavailable
- **WHEN** the active mission provider cannot currently perform a model-selection action
- **THEN** the Mission Workbench shows a provider-specific reason instead of silently failing the action

#### Scenario: Continue action cannot run yet
- **WHEN** the mission runtime is not ready to route a Continue action
- **THEN** the Mission Workbench shows the runtime-specific reason instead of leaving the disabled state unexplained