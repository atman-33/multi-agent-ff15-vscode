## ADDED Requirements

### Requirement: OpenCode roster actions use provider-owned live-pane commands
The system SHALL resolve Continue and model-change roster actions for OpenCode missions through the mission provider adapter and SHALL send the provider-owned live-pane input sequence to the selected agent pane without requiring the mission to be recreated.

#### Scenario: Continue an OpenCode agent conversation from the party roster
- **WHEN** the Mission Workbench sends a Continue roster action for an OpenCode mission with a live agent pane
- **THEN** the agent action controller resolves the OpenCode provider adapter and sends that adapter's Continue input sequence to the live pane

#### Scenario: Change an OpenCode agent model from the party roster
- **WHEN** the Mission Workbench sends a model-change roster action for an OpenCode mission with a valid model id and optional effort value
- **THEN** the agent action controller resolves the OpenCode provider adapter and sends that adapter's model-change input sequence to the live pane

### Requirement: Mission Workbench forwards provider-supported roster model changes
The system SHALL allow Mission Workbench model-change roster actions whenever the pinned mission provider supports the action through the mission provider adapter, even if that provider does not expose the same selectable mission catalog shape as GitHub Copilot.

#### Scenario: Forward an OpenCode roster model change
- **WHEN** the Mission Workbench receives a roster model-change message for an OpenCode mission
- **THEN** it forwards the action to the shared agent action controller instead of discarding the message because the provider-specific mission catalog is empty

### Requirement: GitHub Copilot roster actions stay on the shared adapter path
The system SHALL keep GitHub Copilot Continue and model-change roster actions routed through the mission provider adapter so provider parity does not reintroduce controller-owned provider branches.

#### Scenario: Continue a GitHub Copilot agent conversation from the party roster
- **WHEN** the Mission Workbench sends a Continue roster action for a GitHub Copilot mission with a live agent pane
- **THEN** the action controller sends the GitHub Copilot adapter's Continue input sequence to that pane

#### Scenario: Change a GitHub Copilot agent model from the party roster
- **WHEN** the Mission Workbench sends a model-change roster action for a GitHub Copilot mission with a valid model id and compatible effort
- **THEN** the action controller sends the GitHub Copilot adapter's model-change input sequence and persists the selected model through the adapter