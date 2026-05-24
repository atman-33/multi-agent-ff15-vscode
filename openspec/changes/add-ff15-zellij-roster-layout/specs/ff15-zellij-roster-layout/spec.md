## ADDED Requirements

### Requirement: FF15 launch uses a bundled roster layout template
The extension SHALL store the initial FF15 Zellij layout in a repo-bundled template file and SHALL launch Zellij with that bundled template as the source of truth for the initial pane arrangement.

#### Scenario: Launch resolves the bundled template
- **WHEN** the user starts FF15 from the extension and the required executables are available
- **THEN** the extension launches Zellij with the bundled layout template path
- **THEN** the extension does not generate the initial layout from inline strings or external user-managed layout files

### Requirement: FF15 launch starts the fixed four-agent roster
The bundled FF15 layout SHALL open a fixed 2x2 pane roster for Noctis, Ignis, Gladiolus, and Prompto, and each pane SHALL start the matching OpenCode agent identity command.

#### Scenario: Launch starts all four agents
- **WHEN** the user starts FF15 from the extension and the bundled layout is used
- **THEN** Zellij opens four panes in a 2x2 arrangement
- **THEN** the panes start `opencode --agent noctis`, `opencode --agent ignis`, `opencode --agent gladiolus`, and `opencode --agent prompto`