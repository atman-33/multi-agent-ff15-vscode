## Why

Mission-scoped output routing now stores step artifacts under `.ff15/missions/<missionId>/outputs/<step>/<taskId>/...`, but task identifiers are still fixed as `task-<step>`. Re-running the same step therefore reuses the same output directory and can overwrite earlier attempt artifacts.

Issue #41 asks for deterministic multi-attempt behavior so retries and revision loops can keep prior artifacts while still allowing downstream steps to resolve either the latest attempt or an explicitly requested attempt.

## What Changes

- Generate workflow-aware task identifiers per step attempt (`task-<step>`, `task-<step>-2`, ...).
- Use the generated task identifier consistently in:
  - prompt output-contract guidance paths,
  - step completion contract `submit-report` task id,
  - runtime report validation and required-output verification,
  - follow-up dispatch handoff metadata.
- Add focused regression tests for repeated attempts and selector behavior in both definition prompt composition and runtime probe transitions.

## Capabilities

### New Capabilities
- `ff15-distinct-step-attempt-task-outputs`: repeated attempts of the same step preserve prior mission-scoped outputs by allocating a new task id per attempt.

### Modified Capabilities

## Impact

- Affected extension-host code: `src/features/ff15-operations/definition.ts` and `src/features/ff15-operations/runtime-probe.ts`.
- Affected tests: `definition.test.ts` and `runtime-probe.test.ts`.
- Validation scope: focused operation tests plus repository `lint`, `test`, and `compile` checks.