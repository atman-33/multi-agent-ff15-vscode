## ADDED Requirements

### Requirement: Operation-backed first send SHALL activate canonical workflow step metadata
When a mission has a selected operation and the user sends the first prompt, the extension SHALL load the selected operation from workspace-local `.ff15/operations`, derive the active initial step, and persist canonical workflow step metadata on the mission record.

#### Scenario: First send activates workflow metadata
- **WHEN** the user sends a prompt for a mission whose record includes a supported `operationRef` and no active `workflow.currentStep`
- **THEN** the mission record stores the selected operation's initial step and active task metadata before send completion

### Requirement: Operation-backed send SHALL deliver an operation-aware Noctis prompt
The Noctis delivery path SHALL receive a prompt that includes the selected operation and active step context instead of only the raw user prompt.

#### Scenario: Noctis receives operation-aware prompt context
- **WHEN** the user sends a prompt for a mission with a selected workspace-local operation
- **THEN** the prompt delivered to the Noctis pane includes the operation name, active step, active task, and the user's request

### Requirement: Mission Workbench SHALL reflect activated workflow step state after send
After workflow activation, the Mission Workbench SHALL surface the selected operation, current step, active task, and runtime status from the canonical mission record.

#### Scenario: Workbench shows activated workflow state
- **WHEN** an operation-backed prompt send completes
- **THEN** the Mission Workbench state includes the selected operation together with the activated `workflow.currentStep`, `workflow.activeTask`, and `workflow.runtimeStatus`