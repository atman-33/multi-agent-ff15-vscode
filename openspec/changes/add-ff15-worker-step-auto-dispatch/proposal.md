## Why

Issue #24 lets operation-backed missions accept report-driven transitions, but the loop still stops after the runtime advances to the next step. Issue #25 is needed so worker-owned next steps automatically hand off through the existing mission transport instead of waiting for manual intervention.

## What Changes

- Detect when an accepted report advances an operation-backed mission to a worker-owned next step.
- Reuse the existing mission transport and pane targeting model to deliver a step-specific worker prompt to the correct agent pane inside the mission session.
- Persist dispatch outcome on the canonical mission record so the Mission Workbench surfaces either successful worker handoff or an actionable failure.
- Add focused tests that cover the accepted-report to worker-prompt path.

## Capabilities

### New Capabilities
- `ff15-worker-step-auto-dispatch`: Auto-dispatch worker-owned next steps after an accepted report transition using the existing mission transport.

### Modified Capabilities
- None.

## Impact

- Affected extension-host code includes the runtime probe service, VS Code mission transport wiring, and operation definition parsing.
- Affected canonical mission runtime data includes `.ff15/missions/<missionId>/mission.json`.
- Affected Mission Workbench behavior includes reflecting worker dispatch success or failure after a report transition.
- Affected validation includes focused runtime-probe tests plus repository lint, test, and compile checks.