## ADDED Requirements

### Requirement: OpenCode model catalog is discovered from the local runtime
The system SHALL read OpenCode model metadata from `opencode models --verbose`, parse the discovered models for the target workspace, and cache the latest usable snapshot for that workspace.

#### Scenario: Refresh the OpenCode model catalog for a workspace
- **WHEN** the extension resolves OpenCode model catalog data for a workspace with an available `opencode` runtime
- **THEN** it runs `opencode models --verbose`, parses the discovered models, and stores the latest usable snapshot for that workspace

### Requirement: Mission Workbench renders OpenCode model pickers from the discovered catalog
The system SHALL render OpenCode Mission Workbench roster model pickers from the discovered workspace catalog instead of a hard-coded static list.

#### Scenario: Show an OpenCode mission with a discovered workspace catalog
- **WHEN** the Mission Workbench loads an OpenCode mission for a workspace with a cached or freshly discovered catalog snapshot
- **THEN** the roster model pickers render the discovered model entries for that workspace

### Requirement: Catalog refresh failure degrades only model-change controls
The system SHALL keep Continue actions available when OpenCode catalog refresh fails, and SHALL disable only the model-change controls with a visible reason when no usable catalog is available for the workspace.

#### Scenario: Catalog refresh fails without a usable cached snapshot
- **WHEN** the Mission Workbench loads an OpenCode mission and catalog refresh fails before any usable workspace snapshot exists
- **THEN** Continue remains available for live panes and the model-change controls are disabled with a visible reason that explains the catalog refresh failure

#### Scenario: Catalog refresh fails after a usable cached snapshot already exists
- **WHEN** the Mission Workbench loads an OpenCode mission, catalog refresh fails, and a previous workspace snapshot is still cached
- **THEN** the workbench keeps rendering the cached model entries and marks the catalog state as stale instead of disabling Continue