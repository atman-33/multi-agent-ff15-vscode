## ADDED Requirements

### Requirement: Distinct task ids for repeated step attempts
The extension SHALL allocate a new mission task id for each repeated attempt of the same operation step.

#### Scenario: First and second attempts use different task ids
- **WHEN** a mission executes step `spec-planning` for the first time
- **THEN** the attempt SHALL use `task-spec-planning`
- **AND WHEN** the same step is attempted again after a recorded completion
- **THEN** the new attempt SHALL use `task-spec-planning-2`

### Requirement: Attempt-specific output contract and completion guidance
The extension SHALL render output-contract paths and report completion contracts with the task id of the current attempt.

#### Scenario: Prompt contract targets current attempt output directory
- **WHEN** prompt composition renders output contracts for a repeated step attempt
- **THEN** the rendered path SHALL point to `.ff15/missions/<missionId>/outputs/<step>/<currentAttemptTaskId>/<fileName>`
- **AND** the step completion contract SHALL require submitting the same `<currentAttemptTaskId>`

### Requirement: Consistent selector resolution across retries
The extension SHALL preserve selector behavior across repeated attempts.

#### Scenario: Latest resolves most recent attempt
- **WHEN** multiple completed attempts exist for the same step
- **THEN** `output("<step>", "latest", "<file>")` SHALL resolve to the most recently completed attempt task id

#### Scenario: Explicit selector resolves requested attempt
- **WHEN** a prompt uses `output("<step>", "task:<taskId>", "<file>")`
- **THEN** placeholder resolution SHALL resolve the artifact for that exact `<taskId>` if recorded

### Requirement: Runtime report validation matches current attempt task id
The extension SHALL validate report submissions against the task id of the current attempt, not a fixed per-step id.

#### Scenario: Repeated attempt report with incremented task id is accepted
- **WHEN** the active step is a repeated attempt with current task id `task-<step>-2`
- **AND** the report submission includes `taskId=task-<step>-2`
- **THEN** the runtime SHALL accept the report and continue transition handling