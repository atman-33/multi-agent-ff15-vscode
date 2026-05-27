## Why

Issue #23 activates the first operation-backed step, but worker reports still do not advance or reject workflow state in a controlled way. Issue #24 is needed so generated bridge scripts can submit upstream-style worker reports and the extension-owned runtime can either advance the mission to the next step or preserve an actionable failure.

## What Changes

- Update generated bridge report scripts to submit `taskId`, `next`, and `message` for operation-backed missions.
- Persist the active task id on the canonical mission workflow state so worker reports can be validated against the currently active step.
- Validate report `next` against the selected operation step rules before advancing workflow state.
- Preserve explicit mission failure state when a worker report is invalid, and reflect both successful transitions and actionable failures in mission runtime data and the Mission Workbench.
- Add focused tests for valid and invalid report-driven transitions.

## Capabilities

### New Capabilities
- `ff15-report-driven-transition-loop`: Accept upstream-style worker reports, validate them against the active operation step, and advance or reject mission workflow state accordingly.

### Modified Capabilities
- None.

## Impact

- Affected extension-host code includes the runtime probe bridge handlers, operation-definition parsing, and mission workflow persistence.
- Affected runtime assets include generated PowerShell bridge scripts under `.ff15/bridge`.
- Affected canonical mission runtime data includes `.ff15/missions/<missionId>/mission.json`.
- Affected Mission Workbench behavior includes showing progressed workflow state or actionable errors after report submission.