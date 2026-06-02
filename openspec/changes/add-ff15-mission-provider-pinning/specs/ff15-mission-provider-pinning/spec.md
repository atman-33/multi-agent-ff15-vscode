## ADDED Requirements

### Requirement: Mission records pin the launch provider at creation time
The system SHALL persist a mission-owned launch provider identifier when a mission is created. The provider id SHALL be copied from the current FF15 workspace launch-client setting at creation time.

#### Scenario: Create a mission while OpenCode is selected
- **WHEN** the workspace launch-client setting is `opencode` and the user creates a new mission
- **THEN** the mission record stores `providerId` as `opencode`

### Requirement: Existing missions keep using their pinned provider
The system SHALL resolve mission runtime launch-client behavior from the mission-owned provider id for mission launch, reopen, and prompt-send actions. Changing the workspace launch-client setting after mission creation MUST NOT change the runtime provider used by that mission.

#### Scenario: Reopen a mission after the workspace setting changes
- **WHEN** a mission was created while the workspace launch-client setting was `opencode` and the workspace setting later changes to `github-copilot-cli`
- **THEN** reopening the mission resolves the OpenCode launch client from the mission record instead of the new workspace setting

#### Scenario: Send a prompt after the workspace setting changes
- **WHEN** a mission was created while the workspace launch-client setting was `opencode` and the workspace setting later changes to `github-copilot-cli`
- **THEN** the mission send flow resolves the OpenCode launch client from the mission record instead of the new workspace setting