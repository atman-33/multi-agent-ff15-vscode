## ADDED Requirements

### Requirement: Mission-scoped output contract guidance
The extension SHALL tell agents to create declared operation output files under the active mission runtime tree instead of referring to bare workspace-root filenames.

#### Scenario: Noctis prompt describes mission-scoped output path
- **WHEN** the extension composes an operation-backed prompt for a mission step that declares an output contract
- **THEN** the prompt SHALL identify the output file path under `.ff15/missions/<missionId>/outputs/<stepId>/<taskId>/<fileName>`

#### Scenario: Worker prompt describes mission-scoped output path
- **WHEN** the extension auto-dispatches a worker-owned follow-up step that declares an output contract
- **THEN** the worker prompt SHALL identify the output file path under `.ff15/missions/<missionId>/outputs/<stepId>/<taskId>/<fileName>`

### Requirement: Mission-scoped prior output resolution
The extension SHALL resolve authored `output(...)` placeholders from mission-scoped runtime artifacts for both Noctis and worker-owned step prompts.

#### Scenario: Noctis prompt resolves prior mission-scoped output
- **WHEN** the active step references a prior step output through `output(...)`
- **THEN** prompt composition SHALL resolve that reference to the matching artifact path under the same mission's runtime output tree

#### Scenario: Worker prompt resolves prior mission-scoped output
- **WHEN** a worker-owned step references a prior step output through `output(...)`
- **THEN** prompt composition SHALL resolve that reference to the matching artifact path under the same mission's runtime output tree

### Requirement: Mission-scoped output verification
The extension SHALL provide automated verification that representative operation artifacts are routed into the mission runtime tree instead of the workspace root.

#### Scenario: Focused prompt-composition tests assert mission-scoped paths
- **WHEN** focused prompt-composition tests exercise declared outputs and prior-output placeholders
- **THEN** the assertions SHALL expect `.ff15/missions/<missionId>/outputs/...` paths and SHALL reject bare workspace-root filenames for those artifacts