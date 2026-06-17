## ADDED Requirements

### Requirement: Add file to chat command
The extension SHALL provide a command that adds the relative path of a selected file to the OpenCode chat prompt.

#### Scenario: File selected in explorer
- **WHEN** the user right-clicks a file in the explorer and selects "OpenCode: Add to Chat"
- **THEN** the file's workspace-relative path is sent to the Chat view as `insert-text`

#### Scenario: File selected from editor title context
- **WHEN** the user right-clicks an editor tab and selects "OpenCode: Add to Chat"
- **THEN** the file's workspace-relative path is sent to the Chat view as `insert-text`

### Requirement: Add selection to chat command
The extension SHALL provide a command that adds a code reference for the current editor selection to the OpenCode chat prompt.

#### Scenario: Cursor only
- **WHEN** the editor has no selection and the command runs
- **THEN** the reference format SHALL be `relativePath:line`

#### Scenario: Single-line selection
- **WHEN** the selection is on a single line
- **THEN** the reference format SHALL be `relativePath:line:startCol-endCol`

#### Scenario: Multi-line selection
- **WHEN** the selection spans multiple lines
- **THEN** the reference format SHALL be `relativePath:startLine:startCol-endLine:endCol`

### Requirement: Toggle Chat view command
The extension SHALL provide a command that shows or hides the OpenCode Chat view by focusing or toggling the correct sidebar.

#### Scenario: Chat view is not visible
- **WHEN** the toggle command runs and the Chat view is hidden
- **THEN** the command focuses the Chat view

#### Scenario: Chat view is visible
- **WHEN** the toggle command runs and the Chat view is visible
- **THEN** the command toggles the sidebar visibility and records which sidebar was used
