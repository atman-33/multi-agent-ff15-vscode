## ADDED Requirements

### Requirement: Operation-backed missions SHALL surface extension-owned runtime readiness
When a mission has a selected operation and the Mission Workbench opens, the extension SHALL start or attach to an extension-owned runtime probe for that mission and expose a runtime state of `starting`, `ready`, or `unavailable` to the workbench UI.

#### Scenario: Probe starts for an operation-backed mission
- **WHEN** the Mission Workbench becomes ready for a mission whose record includes a supported `operationRef`
- **THEN** the extension publishes a `starting` runtime state for that mission before the probe finishes

#### Scenario: Probe becomes ready
- **WHEN** the extension-owned runtime probe completes bridge initialization and the readiness self-check succeeds
- **THEN** the Mission Workbench receives a `ready` runtime state for that mission

#### Scenario: Probe is unavailable
- **WHEN** bridge initialization or the readiness self-check fails for an operation-backed mission
- **THEN** the Mission Workbench receives an `unavailable` runtime state with a human-readable reason

### Requirement: Operation probe verdict SHALL be recorded on the mission runtime
The canonical mission runtime record SHALL persist workflow probe metadata for operation-backed missions, including the current runtime status and a concrete `go` or `no-go` verdict with summary data.

#### Scenario: Probe verdict is persisted after a successful self-check
- **WHEN** an operation-backed mission reaches a successful runtime self-check
- **THEN** the mission record stores a `go` verdict together with the latest runtime status and check timestamp

#### Scenario: Probe verdict is persisted after a failed self-check
- **WHEN** an operation-backed mission fails bridge initialization or a runtime self-check
- **THEN** the mission record stores a `no-go` verdict and the failure summary so the Workbench can restore it after reload

### Requirement: Existing runtime probes SHALL be reused for the same mission
The extension SHALL attach to an existing runtime probe for the same workspace and mission instead of starting a duplicate lifecycle whenever the Mission Workbench is reopened.

#### Scenario: Workbench reopens an existing operation-backed mission
- **WHEN** the Mission Workbench opens a mission that already has an active runtime probe in the extension host
- **THEN** the controller reuses the existing probe state and does not create a second probe for the same mission