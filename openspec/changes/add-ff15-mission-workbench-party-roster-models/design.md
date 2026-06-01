## Context

The Mission Workbench currently owns mission title editing, terminal launch, operation selection, prompt delivery, and runtime status projection. Mission records already persist live agent pane ids as `agentPanes`, but the workbench does not expose that roster state or provide per-agent actions. OpenCode model switching is interactive inside a selected pane, so the extension host must route a deterministic input sequence instead of treating model selection as ordinary configuration.

## Goals / Non-Goals

**Goals:**

- Project the fixed FF15 roster into Mission Workbench state with per-agent live pane availability.
- Route raw Continue and OpenCode model-change actions through the extension host to the selected mission pane.
- Persist per-agent model selections on the mission record and rehydrate them into the workbench.
- Keep model effort options model-scoped so future models can expose different effort ranges or no effort step.
- Cover the behavior with focused extension-host and webview tests.

**Non-Goals:**

- Generalize model controls beyond the OpenCode interaction contract.
- Add dynamic party composition or non-FF15 agents.
- Replace the existing mission terminal launch and prompt delivery workflow.

## Decisions

- Extend mission records with `agentModels` keyed by `Ff15AgentId`. This keeps model selections mission-scoped, reuses the existing canonical mission file, and lets workbench state projection stay close to pane projection.
- Keep the model catalog as extension-host master data with model-scoped `efforts` arrays. A model can omit or empty the array to skip the Reasoning Effort input step; tests will cover a custom catalog with a different range and no-effort entry.
- Add a transport-level input sequence API for targeted agent pane input. Continue can send a raw `Continue` submission, while model changes can send `/model`, model name, and optional effort as separate Enter-terminated inputs.
- Render the roster as a bottom workbench panel and use a shadcn context menu for secondary per-agent actions. Disabled actions remain visible when a pane is unavailable so the user can understand live availability without leaving the workbench.

## Risks / Trade-offs

- OpenCode prompt timing is interactive and pane-specific -> keep the command sequence explicit and covered at the transport boundary so later timing adjustments do not leak into UI code.
- Persisting model state per mission can drift from an external manual pane change -> treat persisted values as the workbench source of truth for this slice and leave active pane introspection for a future change.
- The current route is already large -> implement new webview UI as local components instead of growing the main route body further.