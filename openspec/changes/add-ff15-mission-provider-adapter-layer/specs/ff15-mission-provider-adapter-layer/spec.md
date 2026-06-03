## ADDED Requirements

### Requirement: Mission controllers resolve provider behavior through a provider adapter
The system SHALL resolve FF15 mission provider behavior from a provider adapter contract keyed by the mission provider id. Mission and runtime controllers MUST use the resolved adapter for provider-sensitive behavior instead of embedding direct provider conditionals in each controller.

#### Scenario: Reopen mission runtime behavior for an OpenCode mission
- **WHEN** a mission with provider id `opencode` is reopened from the Mission Workbench
- **THEN** the mission controller resolves the OpenCode provider adapter and uses that adapter's runtime behavior without branching directly on `opencode` inside the controller

### Requirement: Mission provider adapters expose roster and model capabilities
The system SHALL expose provider capability flags, model catalog access, and roster action command behavior from the mission provider adapter contract so Mission Workbench controller logic can project supported behavior without direct provider-specific branches.

#### Scenario: Project the Mission Workbench roster for a GitHub Copilot mission
- **WHEN** the Mission Workbench loads a mission with provider id `github-copilot-cli`
- **THEN** the workbench controller reads capability flags and model catalog data from the GitHub Copilot adapter instead of branching directly on the provider id

#### Scenario: Project the Mission Workbench roster for an OpenCode mission
- **WHEN** the Mission Workbench loads a mission with provider id `opencode`
- **THEN** the workbench controller reads the OpenCode adapter's command-driven model behavior and unsupported capabilities from the adapter contract instead of branching directly on the provider id

### Requirement: Adding a provider only requires adapter registration
The system SHALL make future mission providers available by implementing the mission provider adapter contract and registering the adapter, without requiring provider-specific controller edits for the supported mission/runtime behaviors covered by the contract.

#### Scenario: Register a future provider adapter
- **WHEN** a new mission provider adapter is added to the registry with launch/runtime behavior, roster action commands, model catalog access, and capability flags
- **THEN** mission/runtime controller resolution uses the registered adapter through the shared contract without adding a new provider conditional branch in those controllers