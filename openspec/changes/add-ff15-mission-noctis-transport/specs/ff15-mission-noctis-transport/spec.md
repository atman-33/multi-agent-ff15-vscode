## ADDED Requirements

### Requirement: Missions view launches or attaches a deterministic mission-scoped Noctis session
The extension SHALL launch or attach to a deterministic mission-scoped Zellij session from the current workspace root when the user sends the first Noctis prompt for a draft mission.

#### Scenario: First prompt initializes the mission session
- **WHEN** the user sends the first prompt from a draft mission in the Missions view
- **THEN** the extension resolves the current workspace root, derives the mission session name deterministically, ensures the Zellij session exists, and keeps the same mission selected

### Requirement: Mission runtime is persisted under the workspace `.ff15` directory
The extension SHALL persist mission-scoped runtime metadata under the active workspace's `.ff15` directory so mission status and transport bindings survive extension reloads in a visible, file-backed form.

#### Scenario: Mission runtime file is created or updated
- **WHEN** a mission is created or its transport state changes
- **THEN** the extension writes a mission record under `.ff15/missions/<missionId>/mission.json`

#### Scenario: Mission runtime stores session and agent pane bindings
- **WHEN** the extension resolves transport metadata for a mission session
- **THEN** the mission record stores the resolved Zellij session name and an agent-to-pane map keyed by `noctis`, `ignis`, `gladiolus`, and `prompto`

### Requirement: Missions transport delivers prompts through Zellij external control
The extension SHALL resolve the Noctis pane for the mission-scoped Zellij session and SHALL deliver the submitted prompt plus newline through Zellij external control commands rather than a VS Code terminal handle.

#### Scenario: Prompt is delivered to the mission Noctis pane
- **WHEN** the mission session is available and the user submits a prompt
- **THEN** the extension finds the Noctis pane for that mission session, sends the prompt text with `write-chars`, waits a short interaction delay, and then sends `Enter` with `send-keys`

### Requirement: Missions state reflects active and failed delivery outcomes
The extension SHALL update mission state after transport attempts so the Missions view can distinguish draft, active, and failed sends and show a user-facing error when launch, pane lookup, or prompt delivery fails.

#### Scenario: First prompt succeeds
- **WHEN** mission session launch or attach, pane lookup, and prompt delivery all succeed
- **THEN** the mission record is marked active, stores the resolved mission session metadata, and clears any previous transport error

#### Scenario: Transport step fails
- **WHEN** mission session launch, pane lookup, or prompt delivery fails
- **THEN** the mission remains selected, stores a user-facing failure message for that mission, and does not report the send as successful