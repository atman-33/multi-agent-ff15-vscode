## MODIFIED Requirements

### Requirement: Single configuration root

The FF15 Projects context resolver SHALL read harness configuration from `.ff15` within the active workspace root. Configuration files SHALL be located at `.ff15/config/config.yaml` and project profiles SHALL be located under `.ff15/projects/`.

#### Scenario: Configuration exists in .ff15

- **WHEN** `.ff15/config/config.yaml` exists with valid configuration
- **THEN** the resolver loads it and reports `sourceKind` `"ff15"`
- **AND** the resolver reports `sourcePath` pointing to `.ff15`

#### Scenario: Legacy .ff15/harness is ignored

- **WHEN** `.ff15/harness/config/config.yaml` exists but `.ff15/config/config.yaml` does not
- **THEN** the resolver ignores `.ff15/harness` and bootstraps `.ff15/config/config.yaml`

### Requirement: Bootstrap defaults when missing

When `.ff15/config/config.yaml` does not exist, the resolver SHALL create default configuration files under `.ff15` and report that a bootstrap occurred.

#### Scenario: Defaults created on first resolution

- **WHEN** `.ff15/config/config.yaml` does not exist
- **THEN** the resolver writes default `config/config.yaml` and project profiles under `.ff15`
- **AND** the resulting snapshot has `bootstrapped` set to true and `sourceKind` `"ff15"`

#### Scenario: Existing .ff15 directory without config still bootstraps

- **WHEN** `.ff15` already exists for other runtime data but `.ff15/config/config.yaml` does not exist
- **THEN** the resolver creates `.ff15/config/config.yaml` and `.ff15/projects/*.yaml`
- **AND** the resulting snapshot has `bootstrapped` set to true

### Requirement: Existing config is not re-bootstrapped

- **WHEN** `.ff15/config/config.yaml` already exists
- **THEN** the snapshot has `bootstrapped` set to false

### Requirement: Notify on default creation

When default configuration is bootstrapped, the extension SHALL show an information notification referencing `.ff15` at most once per session.

#### Scenario: Notification shown after bootstrap

- **WHEN** the context is resolved and `bootstrapped` is true
- **THEN** the extension shows an information message indicating defaults were created under `.ff15`

#### Scenario: No notification when config already present

- **WHEN** the context is resolved and `bootstrapped` is false
- **THEN** no bootstrap notification is shown
