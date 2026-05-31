## Context

Issue #45 added the Projects resolver and issue #46 added explicit OpenSpec source metadata, but Launch and mission send flows still ask only for a single `workspaceRoot`. That value is currently reused as launch cwd, mission session runtime root, and OpenSpec prompt root even when the resolved Projects configuration points OpenSpec somewhere else.

Issue #48 is cross-cutting because it touches launch orchestration, mission send/session context, and operation prompt composition at the same time. The repository already has a deterministic first-workspace-folder rule and a deterministic Projects resolver, so the missing piece is a shared runtime-context contract that combines them instead of letting each caller reinterpret `workspaceRoot`.

## Goals / Non-Goals

**Goals:**
- Introduce a shared runtime-context contract that separates execution root from resolved OpenSpec root.
- Keep the execution root anchored to the existing first-workspace-folder rule.
- Make Launch and mission session orchestration consume the shared execution root.
- Make operation prompt tooling context consume the resolved OpenSpec root for both `project` and `harness` modes.
- Preserve compatibility with existing `.agents/harness` workflows by reusing the Projects resolver as the source of truth.

**Non-Goals:**
- Changing the Projects sidebar/editor UX again.
- Moving operation-definition loading away from the execution root `.ff15/operations` contract.
- Adding arbitrary workspace selection beyond the existing first-workspace-folder rule.

## Decisions

1. Add a shared runtime-context resolver on top of the existing workspace-root rule and Projects resolver.
   - Why: Launch and Missions need the same derived data, and duplicating this logic would create drift.
   - Shape: the resolved context will at minimum expose `executionRoot`, `openspecRoot`, and the underlying Projects snapshot metadata needed by prompt tooling.
   - Alternative considered: call `resolveFf15ProjectsContext()` separately from each feature and patch values locally. Rejected because the contract would fragment immediately.

2. Keep execution-root behavior unchanged and use the new resolver only to inject the missing OpenSpec root.
   - Why: acceptance criteria explicitly keep the first-workspace-folder runtime rule, so Launch cwd and mission session naming should still derive from the same execution root.
   - Alternative considered: switch runtime cwd to the OpenSpec root in `project` mode. Rejected because that would change terminal/session behavior beyond the issue scope.

3. Extend operation prompt resolution context with `openspecRoot` while preserving `root("app_root")` and `root("execution_root")` semantics.
   - Why: prompt templates already distinguish app/execution roots conceptually; the current bug is that `<tooling-context>` always emits `openspec_root: workspaceRoot`.
   - Alternative considered: redefine `root("app_root")` to mean OpenSpec root. Rejected because that would silently change existing prompt behavior and tests.

4. Treat the Projects resolver as the single compatibility layer for `.agents/harness` and `.ff15/harness` workflows.
   - Why: backward compatibility belongs at the configuration boundary, not in every downstream feature.
   - Alternative considered: add separate compatibility fallbacks inside Launch and Missions. Rejected because it would duplicate precedence logic and weaken test coverage.

## Risks / Trade-offs

- [Risk] Launch and mission tests may still pass while prompt composition uses stale `workspaceRoot` fields.
  → Mitigation: add focused tests that assert both launch cwd and prompt `<tooling-context>` content from the same derived runtime context.

- [Risk] Callers may over-consume raw Projects snapshot data and recreate the old coupling.
  → Mitigation: expose a small runtime-context interface and route downstream callers through that interface instead of the full snapshot where possible.

- [Risk] Legacy workspaces with incomplete Projects bootstrap could produce a null OpenSpec path.
  → Mitigation: keep using resolver-produced readiness/error semantics and fail deterministically in tests rather than inventing hidden fallbacks.

## Migration Plan

1. Add focused tests that show the current `workspaceRoot`-as-everything assumption in launch and prompt composition.
2. Introduce the shared runtime-context resolver and thread it into Launch and Missions.
3. Extend operation prompt context/prompt tests to assert `openspec_root` matches resolved Projects configuration in both `project` and `harness` modes.
4. Run focused tests, then root lint/test/compile.

Rollback: revert the runtime-context resolver introduction and restore direct `getWorkspaceRoot()` wiring in Launch/Missions.

## Open Questions

- No open product questions; the issue acceptance criteria are specific enough for this slice.