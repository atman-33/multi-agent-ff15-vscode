## Context

Current operation prompts and runtime report validation derive task ids from a fixed `task-<step>` shape. Under mission-scoped output routing, that fixed id maps every retry of a step to the same directory, which erases prior attempt outputs and weakens deterministic traceability.

The smallest coherent fix is to centralize task-id allocation on workflow history and apply the same allocator to prompt composition and runtime report handling.

## Goals / Non-Goals

**Goals:**
- Allocate a distinct task id for each repeated attempt of the same step.
- Keep `latest` selectors resolving the most recent completed attempt.
- Keep explicit `task:<taskId>` selectors resolving a specific historical attempt.
- Ensure runtime report validation expects the same task id that prompts instruct agents to report.

**Non-Goals:**
- Legacy workspace-root artifact fallback (issue #40).
- Changing the mission runtime output directory shape introduced by issue #39.

## Decisions

### Allocate the next task id from workflow step history

Task-id allocation inspects existing `stepHistory` entries for the same `fromStep` and produces:
- first attempt: `task-<step>`
- subsequent attempts: `task-<step>-<n>` where `n` is the next attempt number.

This preserves compatibility with existing first-attempt ids while preventing collisions on retries.

### Reuse one allocator in prompt and runtime layers

Both operation prompt composition (`definition.ts`) and runtime transition handling (`runtime-probe.ts`) use the same task-id allocator so:
- output-contract paths and completion contracts point to the current attempt id,
- report validation expects that same id,
- worker/noctis follow-up dispatch remains consistent across retries.

## Risks / Trade-offs

- Existing tests and fixtures that assume fixed ids need targeted updates.
- If workflow history is externally edited with malformed ids, allocation falls back to known valid prefixes and numeric suffixes only.

## Migration Plan

No data migration is required. New attempts after deployment receive distinct task ids; previously recorded attempts remain addressable by their existing task ids.

## Open Questions

- None for this slice.