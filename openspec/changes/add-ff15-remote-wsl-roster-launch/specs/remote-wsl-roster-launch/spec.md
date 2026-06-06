## ADDED Requirements

### Requirement: Remote WSL roster launch uses an external host terminal
The system SHALL open the FF15 roster from the Settings launch flow in an external host terminal when the extension is running in a VS Code Remote - WSL window.

#### Scenario: Launch from Remote - WSL settings view
- **WHEN** the user launches FF15 from the Settings view in a Remote - WSL window
- **THEN** the extension opens an external host terminal instead of a VS Code integrated terminal

### Requirement: Remote WSL roster launch executes inside the active distro
The system SHALL run the FF15 roster launch command inside the active WSL distro using the current workspace root and rendered layout path as Linux-visible paths without Windows path translation.

#### Scenario: Launch command is assembled for the active distro
- **WHEN** the extension prepares the FF15 roster launch command in Remote - WSL
- **THEN** it invokes `wsl.exe` with the active `WSL_DISTRO_NAME`, the current workspace root as `--cd`, and `zellij --layout <layoutPath>` as the Linux-side command

### Requirement: Remote WSL bridge failures are surfaced distinctly
The system SHALL report Remote - WSL bridge launch failures with a user-visible error message that is distinct from missing `zellij` or missing launch-client dependency errors.

#### Scenario: Host bridge launch fails
- **WHEN** the extension cannot start the Windows-side bridge needed for Remote - WSL roster launch
- **THEN** the launch flow returns an error result and shows a Remote - WSL-specific launch error message