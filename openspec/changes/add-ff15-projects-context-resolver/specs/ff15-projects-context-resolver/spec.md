## ADDED Requirements

### Requirement: Harness config source precedence
The extension SHALL resolve harness configuration from the first workspace folder using this strict precedence order: `.agents/harness`, then `.ff15/harness`, then bootstrap `.ff15/harness` if neither exists.

#### Scenario: `.agents/harness` is present and valid
- **WHEN** extension activation loads Projects context and the first workspace folder contains a valid `.agents/harness`
- **THEN** the resolver uses `.agents/harness` as the source and does not read `.ff15/harness`

### Requirement: Bootstrap minimum `.ff15/harness` structure
If both `.agents/harness` and `.ff15/harness` are missing, the extension SHALL create a minimum `.ff15/harness` configuration that can be loaded immediately.

#### Scenario: No harness directories exist
- **WHEN** extension activation resolves Projects context and both harness directories are absent
- **THEN** it creates `.ff15/harness/config/agent-harness.yaml` and `.ff15/harness/projects/default.yaml` plus `.ff15/harness/projects/_template.yaml`, then loads `.ff15/harness`

### Requirement: Invalid `.agents/harness` is a hard error
When `.agents/harness` exists but fails validation, the extension SHALL surface an explicit resolver error and MUST NOT silently fall back to `.ff15/harness`.

#### Scenario: `.agents/harness` exists but config is invalid
- **WHEN** Projects context resolution encounters invalid config under `.agents/harness`
- **THEN** resolver state returns an error for the Projects surface and fallback to `.ff15/harness` is skipped

### Requirement: Projects sidebar exposes resolved context
The extension SHALL provide an FF15 Projects sidebar surface that displays resolver output as read-only fields.

#### Scenario: Projects view renders resolved context
- **WHEN** the Projects sidebar is opened after successful context resolution
- **THEN** it shows source path, active projects, openspec mode, and openspec path from resolver state