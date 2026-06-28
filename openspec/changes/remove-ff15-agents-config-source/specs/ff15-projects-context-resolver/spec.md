## ADDED Requirements

### Requirement: Single configuration root

The FF15 Projects context resolver SHALL read harness configuration only from
`.ff15/harness` within the active workspace root. It SHALL NOT read configuration from
`.agents/harness` or any other root.

#### Scenario: Configuration exists in .ff15/harness

- **WHEN** `.ff15/harness` exists with valid configuration
- **THEN** the resolver loads it and reports `sourceKind` `"ff15"`

#### Scenario: .agents/harness is ignored

- **WHEN** `.agents/harness` exists but `.ff15/harness` does not
- **THEN** the resolver ignores `.agents/harness` and bootstraps `.ff15/harness`

### Requirement: Bootstrap defaults when missing

When `.ff15/harness` does not exist, the resolver SHALL create default configuration
files under `.ff15/harness` and report that a bootstrap occurred.

#### Scenario: Defaults created on first resolution

- **WHEN** neither `.agents/harness` nor `.ff15/harness` exists
- **THEN** the resolver writes default `config/agent-harness.yaml` and project profiles
  under `.ff15/harness`
- **AND** the resulting snapshot has `bootstrapped` set to true and `sourceKind` `"ff15"`

#### Scenario: Existing config is not re-bootstrapped

- **WHEN** `.ff15/harness` already exists
- **THEN** the snapshot has `bootstrapped` set to false

### Requirement: Notify on default creation

When default configuration is bootstrapped, the extension SHALL show an information
notification to the user at most once per session.

#### Scenario: Notification shown after bootstrap

- **WHEN** the context is resolved and `bootstrapped` is true
- **THEN** the extension shows an information message indicating defaults were created

#### Scenario: No notification when config already present

- **WHEN** the context is resolved and `bootstrapped` is false
- **THEN** no bootstrap notification is shown

## REMOVED Requirements

### Requirement: .agents/harness precedence

**Reason**: Consolidating to a single configuration root (`.ff15/harness`) to remove
ambiguity about which root wins.
**Migration**: Move any configuration from `.agents/harness` into `.ff15/harness`.
