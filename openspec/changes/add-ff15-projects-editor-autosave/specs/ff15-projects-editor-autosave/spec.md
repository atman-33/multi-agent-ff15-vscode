## ADDED Requirements

### Requirement: Projects view edits session selection with debounced auto-save
The Projects view SHALL expose editable controls for `active_projects`, `openspec.mode`, and `openspec.project_id`, and MUST persist the latest draft automatically after a debounce window between 300ms and 500ms.

#### Scenario: editing active projects triggers auto-save
- **WHEN** the user changes the selected `active_projects` in the Projects view and stops editing long enough for the debounce window to elapse
- **THEN** the extension host writes the updated session config and refreshes the Projects snapshot without requiring an explicit save action

#### Scenario: project selector uses known profiles
- **WHEN** the Projects view loads a ready snapshot
- **THEN** the available `active_projects` and `openspec.project_id` options are sourced from all known profile ids under the resolved harness `projects/` directory

### Requirement: Saved active projects are normalized without auto-correcting OpenSpec selection
When the Projects view saves `active_projects`, it MUST normalize the saved ids to a deduplicated, lexicographically sorted list and MUST NOT auto-switch `openspec.mode` or `openspec.project_id` as a side effect.

#### Scenario: duplicate and unsorted active projects are normalized
- **WHEN** a save request includes `active_projects` with duplicates or unsorted ids
- **THEN** the written config stores each id once in ascending lexical order

#### Scenario: removing an active project does not rewrite openspec project selection
- **WHEN** the user saves `active_projects` that no longer include the current `openspec.project_id`
- **THEN** the save keeps the existing `openspec.mode` and `openspec.project_id` values unchanged

### Requirement: Invalid project-mode OpenSpec selection rolls back to the last valid state
When `openspec.mode=project`, the save path MUST reject unknown `openspec.project_id` values and the Projects UI MUST roll back to the last valid saved snapshot.

#### Scenario: project mode rejects an unknown project id
- **WHEN** the debounced save runs with `openspec.mode=project` and `openspec.project_id` does not match a known profile id
- **THEN** the save fails with an integrity error and the Projects view returns to the previous valid snapshot

### Requirement: Profile readiness checks remain warnings only
Missing or incomplete profile path/default-check metadata MUST be surfaced as warnings in the Projects snapshot and MUST NOT block loading or saving session config that otherwise passes schema/id validation.

#### Scenario: missing openspec path is reported as a warning
- **WHEN** a known profile lacks a usable `openspec_root`
- **THEN** the Projects snapshot includes a warning for that profile and still renders a ready editor state

#### Scenario: missing default checks are reported as a warning
- **WHEN** a known profile has no configured repository `default_checks`
- **THEN** the Projects snapshot includes a warning for that profile and still allows the profile to be selected and saved

### Requirement: Session config writes preserve authored YAML structure
The extension host SHALL update `agent-harness.yaml` directly while preserving existing comments and the relative ordering of authored keys.

#### Scenario: updating config preserves comments and key order
- **WHEN** the Projects editor saves a change to `active_projects` or `openspec`
- **THEN** existing comments remain in the file and the top-level key order stays consistent with the authored document