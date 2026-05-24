## ADDED Requirements

### Requirement: FF15 launch selects a configured client and defaults to GitHub Copilot CLI
The extension SHALL resolve one FF15 launch client before launch begins. When the user has not changed the FF15 launch-client setting, the extension SHALL select GitHub Copilot CLI by default.

#### Scenario: Default launch client is applied
- **WHEN** the user starts FF15 without changing the launch-client setting
- **THEN** the extension selects the GitHub Copilot CLI launch client
- **THEN** the extension does not require the user to configure FF15 before the first launch attempt

#### Scenario: Explicit launch client is honored
- **WHEN** the user configures FF15 to use a supported non-default launch client
- **THEN** the extension resolves that configured launch client for the next launch attempt

### Requirement: FF15 controller delegates client-specific launch behavior through a launch-client contract
The FF15 launch controller SHALL depend on a launch-client contract rather than direct provider branches. The controller SHALL validate `zellij` plus only the commands required by the selected launch client.

#### Scenario: Selected client dependency is missing
- **WHEN** the user starts FF15 and the selected launch client cannot resolve one of its required commands
- **THEN** the controller reports the selected client's user-facing dependency error
- **THEN** the controller does not validate commands that belong only to other launch clients

#### Scenario: Controller launches through the selected client
- **WHEN** the user starts FF15 and `zellij` plus the selected launch client's commands are available
- **THEN** the controller requests a roster launch plan from the selected launch client
- **THEN** the controller launches Zellij with a layout rendered from that plan

### Requirement: Fixed FF15 roster layout is rendered from a provider-independent pane launch plan
The fixed 2x2 FF15 roster SHALL be defined independently from any specific launch client, and the layout renderer SHALL inject per-pane executable and argument data from the selected client's roster launch plan.

#### Scenario: GitHub Copilot CLI plan is rendered into the roster
- **WHEN** the selected launch client is GitHub Copilot CLI
- **THEN** the rendered roster layout includes pane commands generated from the GitHub Copilot CLI launch plan for Noctis, Ignis, Gladiolus, and Prompto
- **THEN** each GitHub Copilot CLI pane includes the documented `--agent <custom-agent>` arguments needed to launch the matching FF15 agent persona
- **THEN** the layout topology remains the same 2x2 arrangement used by FF15 launch