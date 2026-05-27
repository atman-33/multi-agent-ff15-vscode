## Context

The extension already materializes bundled operations into `.ff15/operations`, persists selected `operationRef` on each mission, and exposes workflow runtime readiness in the Mission Workbench. What is still missing is the first real operation-backed send path: when the user sends the first prompt for a selected operation, the controller does not yet load the operation definition, initialize workflow step metadata, or change the prompt shape that reaches Noctis.

Issue #23 stays inside `multi-agent-ff15-vscode`. It must not depend on sibling repository scripts at runtime, and it must preserve the existing mission transport model while making the first operation-backed send real.

## Goals / Non-Goals

**Goals:**
- Load the selected operation from workspace-local `.ff15/operations` during the first send.
- Initialize canonical workflow metadata for the mission, including current step, active task, and runtime status.
- Send Noctis an operation-aware prompt that includes the active workflow step context.
- Keep the Mission Workbench state projection unchanged so the new workflow metadata shows up automatically.

**Non-Goals:**
- Executing downstream workflow steps or report-driven transitions.
- Full operation-engine orchestration or bridge-driven agent handoff.
- Supporting arbitrary custom operation formats beyond the bundled workspace-local definitions used by this extension.

## Decisions

### Derive the active step from the selected workspace-local operation definition

The send controller will resolve the selected `operationRef` to the matching bundled operation file in `.ff15/operations`, then derive the active step from `initial_step` and the corresponding step entry.

- Chosen because issue #23 explicitly requires the selected operation to become real from the workspace-local runtime copy.
- Alternative considered: use only catalog metadata already in memory. Rejected because the acceptance criteria call for canonical operation metadata under `.ff15`, not just UI-side references.

### Persist workflow activation on the canonical mission record before prompt delivery

The controller will write the activated workflow metadata onto the mission record before sending the prompt so the Workbench and runtime bridge see the same source of truth.

- Chosen because mission workflow state is canonical runtime state, not ephemeral UI state.
- Alternative considered: derive workflow state only in the prompt layer. Rejected because the Workbench would not be able to inspect the activated step after send.

### Keep operation-aware prompt shaping in the send controller

The prompt that reaches Noctis will be composed in the mission send controller from the loaded operation metadata and the user prompt. The transport layer still just sends bytes to the resolved Noctis pane.

- Chosen because the send controller already owns mission-scoped send behavior and is the narrowest place to inject workflow activation.
- Alternative considered: teach the transport layer about operations. Rejected because it would mix workflow semantics into the pane transport.

## Risks / Trade-offs

- [Operation YAML parsing could become brittle] -> Limit the first slice to the metadata needed for issue #23 and cover it with focused tests using the bundled operation shape.
- [Workflow activation might overwrite probe state from issue #22] -> Merge new workflow step metadata onto the existing mission workflow object instead of replacing it wholesale.
- [Prompt context could become too verbose] -> Keep the first operation-aware prompt limited to operation name, active step, active task, and user request.

## Migration Plan

No migration is required. Missions without `workflow.currentStep` remain valid and only activate workflow metadata when the user sends a prompt for a selected operation.

## Open Questions

- None for this slice. Downstream step transitions and richer operation parsing remain follow-up work.