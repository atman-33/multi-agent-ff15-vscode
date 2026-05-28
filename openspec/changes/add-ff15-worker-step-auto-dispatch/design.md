## Context

The extension already supports operation-backed first sends and report-driven step transitions. After issue #24, the runtime can validate `next` against the active step rules and persist the next step on the canonical mission record, but it does not yet continue into worker-owned steps. The worker handoff loop still ends at `workflow.currentStep` even when the next step belongs to Ignis, Gladiolus, or Prompto.

The existing transport model already knows how to reconcile mission panes from a Zellij session and send a prompt to a target pane. The runtime probe service is the narrowest place to connect accepted report transitions to worker dispatch without inventing a second transport layer.

## Goals / Non-Goals

**Goals:**
- Detect worker-owned next steps immediately after an accepted report transition.
- Reuse the existing mission transport and live pane targeting to send a worker prompt inside the mission session.
- Reflect dispatch outcome in canonical mission state so the Mission Workbench can surface success or actionable failure.
- Cover the end-to-end accepted-report to worker-prompt path with focused tests.

**Non-Goals:**
- Replacing the current mission transport model.
- Creating a second workflow engine or full parity with upstream task graphs.
- Solving every missing-pane recovery path beyond returning an actionable failure for this slice.

## Decisions

### Auto-dispatch from the runtime probe service

The runtime probe service will dispatch worker-owned next steps after it accepts and persists a valid report transition.

- Chosen because it already owns the report submission endpoint and canonical workflow mutation.
- Alternative considered: trigger worker dispatch from the Mission Workbench controller. Rejected because bridge-driven reports must work even when the Workbench is not open.

### Reuse the existing mission transport instance

Extension activation will share a single mission transport instance across the send controller, session controller, and runtime probe service so worker handoff uses the same pane reconciliation and prompt delivery behavior as the rest of the mission flow.

- Chosen because issue #25 explicitly requires reusing the existing mission transport and pane targeting model.
- Alternative considered: add a separate runtime-only pane writer. Rejected because it would duplicate pane resolution logic and drift from the validated transport path.

### Report worker handoff failures through canonical mission error state

When auto-dispatch cannot find the worker pane or prompt delivery fails, the mission will keep the accepted next step but record an actionable dispatch failure on `lastError`.

- Chosen because the Mission Workbench already surfaces `lastError` without additional UI plumbing.
- Alternative considered: swallow dispatch failures and keep only the progressed step. Rejected because User would not know why the worker never received the task.

## Risks / Trade-offs

- [Worker pane may be missing when the mission session only has Noctis] -> Return an actionable mission error that points at the missing live worker pane instead of silently failing.
- [Shared transport wiring could widen blast radius] -> Keep the transport instance contract unchanged and validate with focused runtime-probe tests plus full repo checks.
- [Prompt shape may be too thin for downstream worker steps] -> Keep the first slice concise but explicitly step-specific, then deepen composition in a later issue if needed.

## Migration Plan

No migration is required. Existing missions continue to work, and auto-dispatch only activates when a valid report transition lands on a worker-owned next step.

## Open Questions

- None for this first worker handoff slice.