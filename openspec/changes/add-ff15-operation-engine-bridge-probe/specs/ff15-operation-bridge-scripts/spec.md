## ADDED Requirements

### Requirement: Workspace-local bridge scripts SHALL be materialized for runtime entry points
The extension SHALL materialize managed bridge assets under `.ff15/bridge` for any workspace that initializes the operation runtime probe, including scripts for mission lookup, workflow lookup, task submission, and report submission plus manifest data needed to reach the extension-owned runtime entry points.

#### Scenario: Bridge assets are generated during probe initialization
- **WHEN** the first operation-backed mission in a workspace initializes the runtime probe
- **THEN** the workspace gains managed bridge assets under `.ff15/bridge` for mission lookup, workflow lookup, task submission, and report submission

#### Scenario: Bridge manifest reflects the active runtime endpoint
- **WHEN** the extension-owned runtime probe refreshes the workspace bridge assets
- **THEN** the generated manifest records the loopback base URL and authentication data that the scripts need to reach the current runtime endpoint

### Requirement: Bridge scripts SHALL call extension-owned mission and workflow entry points
The generated bridge scripts SHALL reach extension-owned runtime entry points that return mission and workflow metadata for a requested mission.

#### Scenario: Mission lookup script resolves a mission snapshot
- **WHEN** a local bridge script requests mission lookup for a valid mission id in the active workspace
- **THEN** the extension-owned runtime returns the canonical mission snapshot for that mission

#### Scenario: Workflow lookup script resolves workflow metadata
- **WHEN** a local bridge script requests workflow lookup for an operation-backed mission
- **THEN** the extension-owned runtime returns the persisted workflow runtime metadata for that mission

### Requirement: Bridge scripts SHALL submit task and report payloads to the extension runtime
The generated bridge scripts SHALL submit task and report payloads to the extension-owned runtime, and the runtime SHALL acknowledge receipt so later runtime slices can extend the same contract.

#### Scenario: Task submission is acknowledged
- **WHEN** a local bridge script submits a task payload for an operation-backed mission
- **THEN** the extension-owned runtime records the latest active task metadata and returns an acknowledgement payload

#### Scenario: Report submission is acknowledged
- **WHEN** a local bridge script submits a report payload for an operation-backed mission
- **THEN** the extension-owned runtime records the latest step summary or report metadata and returns an acknowledgement payload