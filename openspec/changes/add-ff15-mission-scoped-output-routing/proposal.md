## Why

Issue #36 made authored output placeholders resolvable, but the extension still resolves those artifacts from the workspace root and only tells agents the bare output filename. That breaks the upstream mission-runtime contract and leaves operation artifacts such as `change-brief.md` at the workspace root instead of under the mission runtime tree.

## What Changes

- Add mission-scoped output path helpers under the canonical `.ff15/missions/<missionId>/...` runtime tree.
- Update output-aware prompt composition so declared output files are described with explicit mission-scoped paths for the current step.
- Resolve `output(...)` placeholders from mission-scoped runtime locations for both Noctis prompts and worker-owned step prompts.
- Add focused verification that representative workflow artifacts land under the mission runtime tree instead of the workspace root.

## Capabilities

### New Capabilities
- `ff15-mission-scoped-output-routing`: Route declared operation outputs into mission-scoped runtime directories and resolve prior outputs from the same mission-scoped locations during XML prompt composition.

### Modified Capabilities

## Impact

- Affected extension-host code is concentrated in operation prompt composition and mission runtime path helpers.
- Affected runtime state lives under `.ff15/missions/<missionId>/` for operation-backed workflows.
- Validation must cover focused prompt-composition tests plus repository `lint`, `test`, and `compile` checks.