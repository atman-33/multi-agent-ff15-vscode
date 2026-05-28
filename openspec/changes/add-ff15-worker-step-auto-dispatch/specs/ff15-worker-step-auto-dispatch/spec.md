## ADDED Requirements

### Requirement: Accepted report transitions SHALL auto-dispatch worker-owned next steps
When an accepted report advances an operation-backed mission to a worker-owned next step, the extension SHALL compute the next worker dispatch and target the correct FF15 worker agent.

#### Scenario: Accepted report advances to a worker-owned step
- **WHEN** a report transition resolves to a next step owned by Ignis, Gladiolus, or Prompto
- **THEN** the runtime computes the worker dispatch target for that next step

### Requirement: Worker auto-dispatch SHALL reuse the existing mission transport model
The extension SHALL reuse the existing mission transport and pane targeting model to deliver a step-specific prompt to the correct worker pane inside the mission session.

#### Scenario: Worker prompt is delivered through mission transport
- **WHEN** the runtime auto-dispatches a worker-owned next step
- **THEN** the worker receives a step-specific prompt through the mission transport for the active mission session

### Requirement: Mission runtime and Workbench SHALL reflect the worker dispatch outcome
The canonical mission runtime and Mission Workbench SHALL surface either successful worker handoff or an actionable dispatch failure after an accepted report transition.

#### Scenario: Successful worker handoff is reflected
- **WHEN** worker auto-dispatch succeeds
- **THEN** the mission runtime and Workbench reflect the progressed worker-owned step without an active error

#### Scenario: Worker handoff failure is reflected
- **WHEN** worker auto-dispatch fails after the report transition is accepted
- **THEN** the mission runtime and Workbench preserve the progressed step and record an actionable dispatch error