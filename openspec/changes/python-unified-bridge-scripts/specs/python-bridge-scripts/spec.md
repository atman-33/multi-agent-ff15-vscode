## ADDED Requirements

### Requirement: Generate Python bridge scripts
The system SHALL generate `.py` bridge scripts in the workspace bridge directory instead of `.ps1` scripts.

#### Scenario: Extension writes Python bridge scripts on runtime probe
- **WHEN** the operation runtime probe ensures mission runtime
- **THEN** the bridge directory SHALL contain `get-mission.py`, `get-workflow.py`, `submit-task.py`, and `submit-report.py`

### Requirement: Python bridge scripts read manifest
Each generated Python bridge script SHALL read `bridge-manifest.json` from its own directory to obtain `baseUrl` and `token` for HTTP requests.

#### Scenario: Script reads bridge-manifest.json for baseUrl and token
- **WHEN** a Python bridge script is executed with its required arguments
- **THEN** it SHALL load `bridge-manifest.json` from `$SCRIPT_DIR`
- **AND** it SHALL use the loaded `baseUrl` and `token` to construct the request URL and `Authorization` header

### Requirement: Prompt references Python bridge scripts
Operation-aware prompts SHALL reference `.py` bridge script paths in the step-completion contract instead of `.ps1` paths.

#### Scenario: Operation prompt includes .py path in completion contract
- **WHEN** an operation-aware prompt is built for a mission step
- **THEN** the step-completion contract SHALL contain the `.py` bridge script path
- **AND** it SHALL NOT contain any `.ps1` path

### Requirement: No PowerShell bridge scripts generated
The system SHALL NOT generate any `.ps1` bridge scripts.

#### Scenario: Runtime probe does not write .ps1 files
- **WHEN** the operation runtime probe ensures mission runtime
- **THEN** the bridge directory SHALL NOT contain any `.ps1` files
