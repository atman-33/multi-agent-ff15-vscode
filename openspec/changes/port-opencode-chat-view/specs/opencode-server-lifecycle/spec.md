## ADDED Requirements

### Requirement: OpenCode server starts on extension activation
The extension SHALL spawn `opencode serve` on activation using the configured port, path, and network exposure settings.

#### Scenario: Default activation
- **WHEN** the extension activates with no fixed port configured
- **THEN** it SHALL reuse a stored port from global state or pick a random high port
- **AND** it SHALL persist the selected port in global state

### Requirement: Existing server is reused
The extension SHALL detect an already-running OpenCode server on the selected port and reuse it instead of spawning a new process.

#### Scenario: Server already running
- **WHEN** activation checks the configured port and finds a healthy server
- **THEN** it SHALL not spawn a new process

### Requirement: Server restart command
The extension SHALL provide a restart command that kills the current server process and starts fresh.

#### Scenario: User runs restart
- **WHEN** the restart command executes
- **THEN** the existing process tree is terminated
- **AND** a new server process is spawned

### Requirement: Settings changes prompt restart
The extension SHALL offer to restart the server when the user changes OpenCode port, path, or expose-to-network settings.

#### Scenario: Port setting changes
- **WHEN** the user changes `multi-agent-ff15-vscode.openCode.port`
- **THEN** the extension displays a restart prompt
