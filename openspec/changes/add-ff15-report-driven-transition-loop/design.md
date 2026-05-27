## Context

The extension-owned runtime bridge already exposes mission, workflow, task, and report endpoints, but the task/report handlers are still placeholder acknowledgements. `submit-task.ps1` and `submit-report.ps1` update workflow fields directly without validating whether the incoming report belongs to the active operation step or whether the requested next step is allowed by the selected operation definition.

Upstream `multi-agent-ff15` uses a richer operation runtime, but this repository only needs the first report-driven transition loop for the walking skeleton. The implementation must stay self-contained in `multi-agent-ff15-vscode`, reuse the workspace-local `.ff15/operations` copies, and preserve the Mission Workbench as a projection of canonical mission runtime state.

## Goals / Non-Goals

**Goals:**
- Accept worker reports in the upstream-style `taskId` + `next` + `message` contract.
- Persist enough canonical workflow state to validate reports against the active step.
- Advance `workflow.currentStep` and related mission state only when the report matches the active step rules.
- Preserve an actionable failure on invalid reports without losing the current step context.
- Cover valid and invalid transitions with focused runtime-probe tests.

**Non-Goals:**
- Full parity with the upstream operation engine or delegated worker dispatch ledger.
- Automatic next-worker dispatch after a successful transition.
- Full YAML support for every operation construct beyond the step metadata and rules needed for this slice.

## Decisions

### Extend the lightweight operation parser to include step rules

The runtime bridge will reuse the workspace-local operation definition parser and extend it to capture per-step transition rules. Report validation will resolve the active step from `workflow.currentStep` and then check `next` against the parsed allowed values.

- Chosen because the extension already depends on workspace-local `.ff15/operations` as the canonical operation source.
- Alternative considered: hard-code allowed transitions from current workflow state alone. Rejected because the rules live in the operation definition, not the mission record.

### Persist active task identity on mission workflow state

The canonical mission workflow will store the active task id alongside the active step so report submissions can verify they belong to the current active unit of work.

- Chosen because issue #24 requires worker reports to use the upstream `taskId` contract.
- Alternative considered: validate only the step name. Rejected because stale worker reports would still look valid after a later re-dispatch of the same step.

### Surface invalid report transitions through explicit mission failure state

Invalid report submissions will preserve the current workflow state and write an actionable mission error message instead of silently mutating the mission. Successful transitions will clear mission error state and update workflow progress.

- Chosen because the Mission Workbench already projects `lastError` and canonical workflow fields without additional UI plumbing.
- Alternative considered: encode failures only inside `workflow.probe.summary`. Rejected because probe status is about runtime viability, not report validation failures.

## Risks / Trade-offs

- [Lightweight YAML parsing may miss complex rule constructs] -> Limit parsing to the step and rule fields used by bundled operations and cover the supported shape with focused tests.
- [Self-check behavior could trip transition validation] -> Update the self-check payloads so they use a valid task id and allowed next transition for the probe step.
- [Additional workflow fields increase persisted schema surface] -> Keep new fields optional and normalize missing values for existing missions.

## Migration Plan

No explicit migration is required. Existing missions normalize missing workflow task metadata to `null`, and report validation only applies when an operation-backed mission has an active step.

## Open Questions

- None for this first transition loop slice.