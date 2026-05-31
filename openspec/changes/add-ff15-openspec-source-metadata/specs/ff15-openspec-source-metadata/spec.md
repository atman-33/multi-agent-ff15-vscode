## ADDED Requirements

### Requirement: Resolver reads both v2 and v3 session config versions
Projects context resolver SHALL accept `agent-harness.yaml` version values `2` and `3`, and MUST reject other values with an explicit error.

#### Scenario: v3 config is resolved successfully
- **WHEN** resolver loads a harness config with `version: 3`
- **THEN** it returns a ready snapshot with `configVersion=3`

### Requirement: `openspec.project_id` is independent from `active_projects`
In `openspec.mode=project`, resolver SHALL resolve openspec from `openspec.project_id` regardless of whether that project id appears in `active_projects`, as long as the profile exists.

#### Scenario: project mode uses non-active project id
- **WHEN** `active_projects` does not contain `openspec.project_id` but the matching profile file exists
- **THEN** resolver returns ready and uses that profile's `openspec_root`

### Requirement: Missing project profile fails explicitly
In `openspec.mode=project`, if the profile referenced by `openspec.project_id` is missing, resolver MUST return an explicit error that identifies the missing profile id.

#### Scenario: project mode profile is missing
- **WHEN** `openspec.project_id` points to a non-existent profile file
- **THEN** resolver returns error status with a message mentioning the missing `openspec.project_id`

### Requirement: Resolver exposes openspec source metadata
Ready snapshots SHALL include openspec source metadata so consumers can distinguish source project identity from mode/path.

#### Scenario: project mode includes source project metadata
- **WHEN** resolver returns a ready snapshot for `openspec.mode=project`
- **THEN** snapshot includes `openspec.sourceProjectId=<openspec.project_id>`

#### Scenario: harness mode clears source project metadata
- **WHEN** resolver returns a ready snapshot for `openspec.mode=harness`
- **THEN** snapshot includes `openspec.sourceProjectId=null`

### Requirement: Bootstrap emits v3 baseline config
When resolver bootstraps `.ff15/harness/config/agent-harness.yaml`, it SHALL write `version: 3` while remaining able to read v2 configs.

#### Scenario: bootstrap creates v3 config file
- **WHEN** neither `.agents/harness` nor `.ff15/harness` exists and bootstrap runs
- **THEN** generated `agent-harness.yaml` contains `version: 3`