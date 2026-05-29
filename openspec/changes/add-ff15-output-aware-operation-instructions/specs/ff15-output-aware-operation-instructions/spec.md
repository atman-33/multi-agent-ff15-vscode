## ADDED Requirements

### Requirement: Operation prompt delivery SHALL resolve authored output-aware placeholders before XML assembly
Before the extension delivers an XML prompt for an operation-backed mission step, it SHALL resolve supported authored placeholders for prior outputs, workspace roots, runtime asset paths, and relevant settings using canonical runtime state plus workspace-local artifacts.

#### Scenario: XML prompt includes resolved authored guidance
- **WHEN** the active step for a real bundled workflow references supported output-aware placeholders in its authored content
- **THEN** the delivered XML prompt includes resolved guidance and artifact references instead of raw template tokens

### Requirement: Output-contract references SHALL resolve against canonical mission runtime state
When authored content references a prior output or named output contract, the extension SHALL resolve that reference against canonical mission runtime state for the current mission and active workflow.

#### Scenario: Prior output reference resolves successfully
- **WHEN** authored content references a prior step output that exists for the current mission
- **THEN** the XML prompt includes the resolved output guidance or artifact reference for that prior output

#### Scenario: Missing prior output fails actionably
- **WHEN** authored content references a prior output or output contract that is unavailable for the current mission
- **THEN** prompt delivery fails with an actionable runtime error naming the missing reference

### Requirement: Missing workspace-local artifacts or settings SHALL fail actionably
When authored content references a workspace-local artifact or required setting that cannot be resolved, the extension SHALL fail prompt delivery with an actionable runtime error rather than emitting raw template tokens.

#### Scenario: Missing workspace-local artifact fails actionably
- **WHEN** authored content references a workspace-local file or runtime artifact that does not exist
- **THEN** prompt delivery fails with an actionable runtime error that identifies the missing artifact

#### Scenario: Missing required setting fails actionably
- **WHEN** authored content references a required FF15 setting value that is unavailable
- **THEN** prompt delivery fails with an actionable runtime error that identifies the missing setting