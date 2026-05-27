## ADDED Requirements

### Requirement: Extension materializes bundled builtin operations into workspace runtime
The extension SHALL materialize its bundled builtin operation definitions into the active workspace under `.ff15/operations` so operation-backed mission work uses a workspace-local, inspectable catalog.

#### Scenario: First workbench access creates the bundled catalog
- **WHEN** the user opens a Mission Workbench in a workspace that does not yet have a managed operations catalog under `.ff15/operations`
- **THEN** the extension writes the bundled builtin operation definitions into that workspace-local runtime area before presenting the mission-facing operations catalog

#### Scenario: Managed catalog refresh preserves unrelated mission runtime state
- **WHEN** the extension refreshes the managed bundled operations catalog for the workspace
- **THEN** it updates only the extension-managed files under `.ff15/operations` and does not overwrite unrelated mission runtime data such as `.ff15/missions/**`

### Requirement: Operations catalog distinguishes supported and unsupported bundled operations
The extension SHALL expose bundled operations in the mission-facing catalog with explicit supported or unsupported status based on the extension's currently supported agents and runtime scope.

#### Scenario: Supported operation is available for selection
- **WHEN** a bundled operation only requires the extension's current supported FF15 roster and issue #21 runtime scope
- **THEN** the Mission Workbench shows that operation as selectable in the operations catalog

#### Scenario: Unsupported bundled operation stays visible with a reason
- **WHEN** a bundled operation requires an unsupported agent or runtime capability outside issue #21 scope
- **THEN** the Mission Workbench still shows that operation in the catalog as unavailable and explains why it cannot be selected