## ADDED Requirements

### Requirement: Extension bundles authoritative FF15 agent definitions
The extension SHALL package the FF15 GitHub Copilot and OpenCode agent definition files from a single authoritative mirrored resource tree under `src/resources/workspace-template`.

#### Scenario: Packaged resources include both agent client variants
- **WHEN** the extension is built or packaged
- **THEN** the bundled resources include the FF15 GitHub Copilot agent files and the FF15 OpenCode agent files from `src/resources/workspace-template`

### Requirement: Activation materializes managed FF15 agent files into the workspace
When the extension activates with a resolvable workspace root, it SHALL create the managed FF15 agent files under `.github/agents` and `.opencode/agents` in that workspace.

#### Scenario: Workspace root is available on activation
- **WHEN** the extension activates and resolves a workspace root
- **THEN** the workspace contains the managed FF15 GitHub Copilot agent files under `.github/agents`
- **AND** the workspace contains the managed FF15 OpenCode agent files under `.opencode/agents`

#### Scenario: Workspace root is unavailable on activation
- **WHEN** the extension activates without a resolvable workspace root
- **THEN** the extension skips agent materialization without failing activation

### Requirement: Activation refreshes the managed FF15 agent files
The extension SHALL overwrite the managed FF15 workspace agent files on each activation so bundled agent updates are propagated automatically.

#### Scenario: Managed file already exists in the workspace
- **WHEN** the extension activates and a managed FF15 agent file already exists at the destination path
- **THEN** the extension replaces that file with the current bundled resource contents