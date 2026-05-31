## ADDED Requirements

### Requirement: Projects editor refreshes on external config changes
The system SHALL watch the resolved Projects session config and project profile files while the Projects editor is open and SHALL refresh the editor state automatically when external changes occur and there are no pending local edits.

#### Scenario: External change refreshes a clean editor
- **WHEN** the Projects editor is open, the current draft matches the last accepted snapshot, and the watched config or profile files change externally
- **THEN** the extension reloads the latest Projects snapshot from disk and posts the refreshed state to the Projects editor without requiring a manual reopen

### Requirement: Projects editor requires explicit conflict resolution for dirty drafts
The system MUST NOT silently apply external Projects config changes over a pending local draft.

#### Scenario: External change pauses a pending local draft
- **WHEN** the Projects editor has pending local edits and a watched config or profile file changes externally
- **THEN** the extension cancels silent autosave for the local draft
- **AND** the extension presents explicit conflict actions for reload, discard local, and keep local before applying any external state

#### Scenario: Reload applies the queued external snapshot
- **WHEN** the Projects editor is showing a conflict prompt for an external change
- **AND** the user chooses reload
- **THEN** the extension replaces the editor state with the latest external Projects snapshot
- **AND** the pending local draft is cleared

#### Scenario: Discard local restores the last accepted in-editor snapshot
- **WHEN** the Projects editor is showing a conflict prompt for an external change
- **AND** the user chooses discard local
- **THEN** the extension restores the last accepted Projects snapshot that was already loaded in the editor
- **AND** the pending local draft is cleared without silently applying the queued external snapshot

#### Scenario: Keep local resumes an explicit local save path
- **WHEN** the Projects editor is showing a conflict prompt for an external change
- **AND** the user chooses keep local
- **THEN** the extension keeps the local draft in the editor
- **AND** any subsequent overwrite of on-disk state happens only through the resumed local save path triggered after that explicit choice