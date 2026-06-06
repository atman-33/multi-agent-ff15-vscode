## ADDED Requirements

### Requirement: Mission terminal reopen uses WSL external terminal in Remote - WSL
The system SHALL open an external host terminal when the user opens or reopens a mission terminal from the Mission Workbench while the extension is running in a VS Code Remote - WSL window.

#### Scenario: Mission terminal reopen in Remote - WSL
- **WHEN** the user clicks "Open Terminal" or "Reopen Terminal" in the Mission Workbench while the extension is in a Remote - WSL window
- **THEN** the extension opens an external host terminal instead of a VS Code integrated terminal

### Requirement: Mission WSL bridge failures are surfaced distinctly from Linux-side dependency failures
The system SHALL report Remote - WSL bridge launch failures during mission terminal reopen with a user-visible error message that is distinct from missing `zellij` or missing launch-client dependency errors.

#### Scenario: WSL distro name unavailable during mission terminal reopen
- **WHEN** the user opens a mission terminal in a Remote - WSL window and `WSL_DISTRO_NAME` is not set in the remote environment
- **THEN** the mission status transitions to "error" and the user sees the WSL-distro-missing message, not the generic zellij-missing message

#### Scenario: Host bridge launch fails during mission terminal reopen
- **WHEN** the extension fails to start the Windows-side bridge needed for mission terminal reopen in Remote - WSL
- **THEN** the mission status transitions to "error" and the user sees the Remote - WSL bridge failure message, not a generic launch failure message

### Requirement: Non-WSL mission terminal reopen behavior is unchanged
The system SHALL preserve existing mission terminal reopen behavior (integrated terminal or local Windows external terminal) when not running in Remote - WSL.

#### Scenario: Mission terminal reopen on local Linux
- **WHEN** the user opens a mission terminal from the Mission Workbench on a local Linux host
- **THEN** the terminal opens as a VS Code integrated terminal, unchanged from current behavior
