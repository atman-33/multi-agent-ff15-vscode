## ADDED Requirements

### Requirement: FF15 sidebar exposes a dedicated Settings view
The extension SHALL contribute a Settings view inside the FF15 activity bar container as a separate sidebar surface from the Launch view.

#### Scenario: FF15 sidebar shows launch and settings separately
- **WHEN** the user opens the FF15 activity bar container
- **THEN** the extension shows a Launch view and a separate Settings view
- **THEN** the Settings view appears as its own FF15 sidebar entry rather than launch controls embedded into the Launch view

### Requirement: FF15 Settings view opens the extension settings through an FF15 command
The extension SHALL contribute an FF15-specific command for opening the extension's settings namespace, and the Settings view SHALL use that command as its primary action.

#### Scenario: User opens FF15 settings from the sidebar
- **WHEN** the user triggers the primary action in the FF15 Settings view
- **THEN** the extension executes the FF15 settings command
- **THEN** that command opens VS Code Settings scoped to the FF15 extension namespace

### Requirement: FF15 Launch view remains focused on launching
The extension SHALL keep the Launch view focused on starting FF15 and SHALL not require settings-specific controls to access FF15 configuration.

#### Scenario: Settings entry point moves out of launch responsibilities
- **WHEN** the user needs to adjust FF15 configuration before or after launching
- **THEN** the user can open FF15 settings from the dedicated Settings view
- **THEN** the Launch view can remain focused on starting FF15 for the active workspace