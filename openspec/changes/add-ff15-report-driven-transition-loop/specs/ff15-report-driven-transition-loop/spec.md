## ADDED Requirements

### Requirement: Generated bridge reports SHALL use the worker report contract
The extension SHALL generate bridge report scripts for operation-backed missions that submit worker reports using `taskId`, `next`, and `message`.

#### Scenario: Report script submits worker report fields
- **WHEN** the runtime bridge assets are materialized for an operation-backed mission
- **THEN** the generated report submission script sends `taskId`, `next`, and `message` to the mission report endpoint

### Requirement: Runtime SHALL validate report transitions before advancing workflow state
When a worker report arrives for an operation-backed mission, the runtime SHALL validate the report task id and requested `next` value against the active workflow step before mutating canonical mission state.

#### Scenario: Valid report advances the workflow
- **WHEN** a worker report includes the active task id and an allowed `next` value for the active step
- **THEN** the mission workflow advances to the next step and records the report message summary

#### Scenario: Invalid report preserves failure state
- **WHEN** a worker report includes an unexpected task id or a disallowed `next` value for the active step
- **THEN** the mission keeps the current workflow step and records an actionable failure state instead of advancing

### Requirement: Mission runtime and Workbench SHALL reflect report-driven progress or failure
The canonical mission runtime and Mission Workbench SHALL expose either the progressed step state or the actionable validation error after report submission.

#### Scenario: Workbench reflects successful transition state
- **WHEN** a valid worker report advances the workflow
- **THEN** the mission runtime and Workbench show the new current step, active task, and last report summary

#### Scenario: Workbench reflects actionable report failure
- **WHEN** a worker report is rejected by validation
- **THEN** the mission runtime and Workbench continue showing the current step together with the validation error