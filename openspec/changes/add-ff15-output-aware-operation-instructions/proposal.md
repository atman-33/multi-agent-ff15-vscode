## Why

Issue #34 and #35 moved operation-backed missions onto XML prompts, but the prompt layer still injects authored instructions and output contracts almost verbatim. Real bundled workflows depend on placeholders for prior outputs, workspace-local artifact paths, workspace roots, and extension settings, so the current behavior leaves raw template tokens in the prompt instead of actionable guidance.

Issue #36 is needed so the extension resolves those authored placeholders against canonical runtime state and workspace-local assets before prompt delivery, and so failures surface as actionable runtime errors instead of silent malformed prompts.

## What Changes

- Add output-aware placeholder resolution for operation-authored job, instruction, policy, and output-contract content before XML prompt delivery.
- Resolve placeholders for prior outputs, workspace roots, settings values, and workspace-local artifact references using canonical mission state plus workspace-local `.ff15` assets.
- Fail prompt composition with actionable runtime errors when a referenced artifact, output contract, or setting cannot be resolved.
- Cover successful resolution and missing-artifact / missing-contract failures with focused tests against real bundled workflow assets.

## Capabilities

### New Capabilities
- `ff15-output-aware-operation-instructions`: Resolve output-aware authored placeholders before XML mission prompt delivery.

### Modified Capabilities
- `ff15-worker-step-auto-dispatch`: Worker prompts should consume the same resolved authored guidance as Noctis prompts.

## Impact

- Affected extension-host code includes operation prompt composition, mission workflow state lookups, and runtime prompt delivery.
- Affected workspace-local runtime assets include `.ff15/missions/<missionId>/mission.json`, `.ff15/operations`, and generated bridge/facet references consumed during prompt composition.
- Affected validation includes focused prompt-composition tests plus repository lint, test, and compile checks.