## ADDED Requirements

### Requirement: Party roster state projection
The Mission Workbench SHALL project the fixed FF15 party roster for Noctis, Ignis, Gladiolus, and Prompto with each agent's mission pane availability, current model value, and selectable model catalog metadata.

#### Scenario: Mission has mixed pane availability
- **WHEN** a mission record has live pane ids for some fixed party agents and null pane ids for others
- **THEN** the workbench state includes all four fixed agents with availability derived per agent from the mission pane map

#### Scenario: Mission model values are missing
- **WHEN** a mission record has no persisted model selections
- **THEN** the workbench state includes fallback model selections for all four fixed agents using the OpenCode model contract source of truth

### Requirement: Raw continue routing
The Mission Workbench SHALL expose a per-agent raw Continue action through a shadcn context menu and route enabled actions through the extension host to the selected live pane.

#### Scenario: Continue action is enabled
- **WHEN** the user selects Continue for a roster agent with a live pane id
- **THEN** the extension host sends the raw Continue command to that agent's mission pane and refreshes the workbench state

#### Scenario: Continue action is disabled
- **WHEN** the user opens actions for a roster agent without a live pane id
- **THEN** the Continue action is disabled and no continue command is posted for that agent

### Requirement: OpenCode model contract
The Mission Workbench SHALL use the approved OpenCode model-change flow of sending `/model`, pressing Enter, sending the exact model name, pressing Enter, and then sending the selected Reasoning Effort number when the selected model supports effort selection.

#### Scenario: Model supports effort selection
- **WHEN** the user selects `GPT-5.4` or `GPT-5 mini` with effort `1`, `2`, or `3` for an agent with a live pane id
- **THEN** the extension host sends `/model`, the exact model name, and the selected effort number as separate Enter-terminated inputs to that agent pane

#### Scenario: Model omits effort selection
- **WHEN** the selected model definition has no effort options
- **THEN** the extension host sends only `/model` and the exact model name as Enter-terminated inputs and skips the effort step

### Requirement: Model-scoped effort master data
The Mission Workbench SHALL resolve Reasoning Effort options from the selected model definition instead of a single global effort list.

#### Scenario: Initial supported models
- **WHEN** the workbench projects the default OpenCode model catalog
- **THEN** `GPT-5.4` and `GPT-5 mini` each expose effort `1` as Low, `2` as Medium, and `3` as High

#### Scenario: Future model has a different range
- **WHEN** a model definition exposes efforts `1`, `2`, `3`, and `4`
- **THEN** the workbench presents and routes only that model's four effort options for the selected agent

### Requirement: Per-agent model persistence
The Mission Workbench SHALL persist each agent's selected model value as mission state and project the updated value back into the workbench after a successful model change.

#### Scenario: Agent model changes successfully
- **WHEN** the user changes an individual agent model through the workbench and routing succeeds
- **THEN** the mission record stores that agent's selected model id and effort value and the refreshed workbench state displays the new value on that agent card

#### Scenario: Agent pane is unavailable
- **WHEN** the user attempts to change a model for an agent without a live pane id
- **THEN** the extension host does not persist a new value and reports the action as unavailable in refreshed workbench state