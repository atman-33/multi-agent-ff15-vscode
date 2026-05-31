## ADDED Requirements

### Requirement: FF15 SHALL resolve runtime context from Projects configuration
The extension SHALL derive a shared runtime context for Launch and Missions where the execution root comes from the existing first-workspace-folder rule and the OpenSpec root comes from the resolved Projects configuration.

#### Scenario: Launch uses the first workspace folder as execution root
- **WHEN** FF15 Launch resolves runtime context in a multi-folder workspace
- **THEN** the launch cwd MUST use the same first-workspace-folder rule already used by the extension
- **AND** the resolved OpenSpec root MUST NOT change that launch cwd selection

#### Scenario: Runtime context uses resolved project-mode OpenSpec path
- **WHEN** Projects configuration resolves `openspec.mode=project`
- **THEN** the shared runtime context MUST expose the resolved project OpenSpec path as `openspec_root`
- **AND** the execution root MUST remain the runtime root selected by the workspace-folder rule

#### Scenario: Runtime context uses resolved harness-mode OpenSpec path
- **WHEN** Projects configuration resolves `openspec.mode=harness`
- **THEN** the shared runtime context MUST expose the harness-owned OpenSpec path as `openspec_root`
- **AND** the execution root MUST remain the runtime root selected by the workspace-folder rule

### Requirement: Mission prompt tooling context SHALL use resolved OpenSpec semantics
Operation-aware mission prompt composition SHALL use the shared runtime context so tooling metadata exposes the resolved OpenSpec root independently from execution-root placeholders.

#### Scenario: Tooling context separates execution root and OpenSpec root
- **WHEN** the mission send flow builds an operation-aware prompt
- **THEN** the prompt MUST emit `execution_root` and `app_root` from the shared execution root semantics already supported by the system
- **AND** the prompt MUST emit `openspec_root` from the resolved Projects OpenSpec path

#### Scenario: Existing root placeholders remain execution-root based
- **WHEN** a prompt instruction resolves `{{ root("execution_root") }}` or `{{ root("app_root") }}`
- **THEN** those placeholders MUST continue to resolve from the shared execution root
- **AND** they MUST NOT be silently remapped to the OpenSpec root

### Requirement: Existing harness workflows SHALL remain compatible
The runtime-context propagation change SHALL remain compatible with existing `.agents/harness` and `.ff15/harness` configuration precedence rules by reusing the Projects resolver contract.

#### Scenario: Agents harness workflows continue to propagate resolved context
- **WHEN** a workspace resolves Projects configuration from `.agents/harness`
- **THEN** Launch and mission prompt composition MUST use the derived runtime context from that resolver result
- **AND** they MUST NOT fall back to treating the raw workspace root as the OpenSpec root