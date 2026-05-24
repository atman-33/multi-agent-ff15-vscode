## ADDED Requirements

### Requirement: Sidebar provides an FF15 launch surface
The extension SHALL replace the sample-oriented sidebar experience with a minimal FF15 launch surface that provides a primary action for starting work from the current VS Code workspace.

#### Scenario: User opens the FF15 sidebar view
- **WHEN** the extension activates and the user opens the contributed FF15 sidebar view
- **THEN** the view presents a minimal FF15 launch surface instead of the boilerplate sample views

#### Scenario: Launch action targets the current workspace
- **WHEN** the user triggers the primary launch action from the FF15 sidebar view
- **THEN** the extension resolves a workspace root from the current VS Code window and uses that root as the launch target

### Requirement: Launch flow validates dependencies before starting Zellij
The extension SHALL verify that `zellij` and `opencode` are available before attempting to open Zellij, and SHALL stop with a clear user-facing error when a required dependency is unavailable.

#### Scenario: Zellij is unavailable
- **WHEN** the user triggers the primary launch action and `zellij` cannot be executed
- **THEN** the extension does not start the launch flow and shows a clear error that Zellij is required

#### Scenario: OpenCode is unavailable
- **WHEN** the user triggers the primary launch action and `opencode` cannot be executed
- **THEN** the extension does not start the launch flow and shows a clear error that OpenCode is required

#### Scenario: Dependencies are available
- **WHEN** the user triggers the primary launch action and both `zellij` and `opencode` are executable
- **THEN** the extension opens a new external terminal window rooted at the resolved workspace and starts Zellij there