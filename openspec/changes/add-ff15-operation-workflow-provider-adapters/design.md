## Context

The mission provider adapter already owns provider-specific launch client creation, model catalog access, and roster input sequences. Operation workflow delivery still sits outside that boundary in two places: the initial activation send path in `controller.ts` and runtime-driven follow-up dispatch in `runtime-probe.ts`. Both flows already build provider-neutral XML operation prompts, so the remaining gap is the delivery/runtime contract rather than prompt composition.

## Goals / Non-Goals

**Goals:**
- Make operation-backed mission activation resolve the pinned mission provider before prompt delivery.
- Make runtime follow-up dispatch reuse the same provider-owned delivery contract for worker and Noctis steps.
- Preserve existing provider-neutral prompt builders and keep provider state mission-scoped.

**Non-Goals:**
- Redesign operation prompt XML structure.
- Expand Mission Workbench roster capabilities beyond the provider metadata already added in issue #61.
- Introduce a new global transport abstraction outside the mission provider adapter boundary.

## Decisions

1. Extend the mission provider adapter with an operation-delivery method instead of duplicating provider branching in controllers.
   - Why: the adapter already represents the provider-owned runtime boundary for a mission, so workflow delivery belongs there.
   - Alternative considered: keep a shared helper in `controller.ts` or `runtime-probe.ts`. Rejected because it would preserve controller-owned provider conditionals.

2. Keep prompt construction in `controller.ts` and `runtime-probe.ts`, and hand the already-built prompt plus mission/workflow context into the adapter.
   - Why: prompt composition is intentionally provider-neutral and already validated by existing issue slices.
   - Alternative considered: move prompt building into the adapter. Rejected because it would mix provider-neutral workflow content with provider-specific delivery semantics.

3. Reuse mission transport from inside adapter implementations where appropriate rather than replacing transport wholesale.
   - Why: the issue is about ownership of delivery decisions, not replacing the underlying send primitives.
   - Alternative considered: add a second transport layer for operation workflows. Rejected as needless indirection for this slice.

## Risks / Trade-offs

- Adapter contract drift between activation and runtime dispatch paths -> cover both paths with focused tests that assert the adapter is resolved and invoked.
- Provider implementations may need slightly different pane resolution inputs -> pass explicit context objects into the adapter rather than letting controllers guess provider-specific details.
- Stacked branch work from issue #61 could hide regressions -> rerun the focused mission/runtime tests before full repo checks.