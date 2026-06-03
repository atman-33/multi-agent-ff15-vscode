## Context

Issue #57 moved provider-owned mission state under `providerState`, but mission/runtime controllers still branch directly on `providerId` when they need launch behavior, continue commands, model changes, and model catalog access. The repo already has a nearby precedent in the launch-client abstraction from issue #9: controllers ask a shared contract for provider behavior, and provider-specific decisions stay in registry-resolved implementations.

The next slice needs the same separation for FF15 missions without widening into a full OpenCode model-management redesign. Windows-first behavior, self-contained runtime assets, and the fixed four-agent roster remain unchanged.

## Goals / Non-Goals

**Goals:**
- Introduce a mission provider adapter contract and registry for FF15 mission/runtime flows.
- Route mission session launch/reopen, continue/model-change commands, model catalog access, and provider capability checks through the adapter layer.
- Keep provider-owned persisted mission state unchanged except where the adapter contract reads from existing `providerState`.

**Non-Goals:**
- Add a new mission provider picker or expand the visible roster beyond the current four agents.
- Implement a full OpenCode-managed selectable model catalog.
- Rework unrelated mission workflow or operation runtime behavior.

## Decisions

### Resolve mission behavior from a provider adapter registry
Create a mission-provider adapter contract plus a registry resolver keyed by mission `providerId`. Controllers receive the adapter or resolve it once, then use the contract rather than branching on provider ids inline.

Alternative considered: keep existing `providerId` branches and extract only helper functions. Rejected because it still leaves controller behavior split across provider conditionals and does not satisfy the acceptance criteria for future provider registration.

### Keep launch/runtime and roster/model behaviors on one adapter surface
The adapter contract covers the provider capabilities needed by the touched mission flows: launch/runtime behavior, continue/model-change input sequences, model catalog access, and capability flags. This keeps the Mission Workbench and runtime controllers on the same abstraction boundary rather than creating separate provider helpers for each slice.

Alternative considered: separate runtime adapters from workbench adapters. Rejected for now because the current scope is still local to `src/features/ff15-missions` and a single contract is enough to remove controller-owned branching without adding more indirection than necessary.

### Leave provider-owned state schemas and unsupported capabilities provider-specific
Adapters read the existing provider-owned state and can expose unsupported capabilities explicitly. GitHub Copilot can keep the selectable model catalog while OpenCode can report non-selectable or command-driven behavior without forcing a shared schema expansion.

Alternative considered: normalize all providers to one fully shared model schema now. Rejected because issue #58 is about isolating behavior, not re-centralizing provider differences.

## Risks / Trade-offs

- [Adapter contract grows too broad too early] -> Keep the first contract limited to behavior already required by mission controllers and capability projection.
- [Controllers keep shadow provider branches after extraction] -> Add focused tests that fail when controllers bypass the adapter for provider-sensitive behavior.
- [Future providers need different model semantics] -> Model unsupported or provider-owned behavior as explicit capabilities and provider-returned data instead of forcing fake parity.