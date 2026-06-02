## Context

FF15 mission runtime behavior already depends on the shared launch-client abstraction, but the VS Code mission wiring still resolves that client from the live workspace setting each time a mission action runs. Mission records also lack a persisted provider id, so existing missions drift when the global setting changes after creation.

## Goals / Non-Goals

**Goals:**
- Persist a mission-owned provider id at creation time.
- Make mission launch, reopen, and send flows resolve from the mission-owned provider.
- Keep the change narrow enough that later provider-aware model-schema work can build on it without reworking the mission runtime entry points.

**Non-Goals:**
- Add mission-level provider selection UI.
- Redesign agent model state for provider-specific schemas.
- Introduce provider runtime adapters for roster actions beyond the existing mission launch/send entry points.

## Decisions

### Persist `providerId` on the canonical mission record
Mission records gain a required `providerId` field. New missions capture the current workspace launch-client setting once and persist it alongside the rest of the mission runtime state. This keeps the provider contract local to the mission and avoids recomputing provider identity from ambient settings.

Alternative considered: continue deriving provider from the workspace setting on each action. Rejected because it violates mission continuity and fails the issue acceptance criteria.

### Resolve launch clients from `mission.providerId` in mission runtime entry points
The mission send controller and mission session controller now accept a resolver that receives the mission record and returns the matching launch client. The VS Code wiring reads the workspace setting only for mission creation; every later mission runtime action uses the pinned provider from the mission record.

Alternative considered: duplicate provider branching inside each mission controller. Rejected because the launch-client contract already exists and this slice should keep provider logic in one place.

### Leave provider-specific roster/model behavior to later slices
This slice does not refactor agent model state or introduce provider runtime adapters for all roster controls. It only ensures the runtime controller entry points are anchored to the mission-owned provider so later provider-aware work can extend a stable base.

## Risks / Trade-offs

- [Existing missions created before `providerId` persistence] -> Normalize missing values through the existing launch-client id resolver so old records keep a safe default instead of crashing.
- [Future provider-aware model state may change mission shape again] -> Keep this slice limited to `providerId` persistence and controller resolution so later schema work can layer on top without undoing provider pinning.
- [VS Code wiring could regress back to the workspace setting] -> Cover the adapter path with a focused test that creates a mission under one setting and opens it after the global setting changes.