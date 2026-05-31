## Why

The extension currently treats one workspace root as both execution context and project context, so users cannot see or verify where harness config is resolved from. This change adds an explicit, deterministic resolver and visible Projects surface so configuration behavior is transparent and predictable.

## What Changes

- Add a harness config resolver that uses first-workspace-folder precedence: `.agents/harness` -> `.ff15/harness` -> bootstrap `.ff15/harness` when neither exists.
- Add read-only Projects sidebar view in FF15 that shows resolved config source, active projects, and openspec mode/path.
- Add validation behavior where invalid `.agents/harness` is reported as an error and does not silently fall back to `.ff15/harness`.
- Add bootstrap flow for minimum files at `.ff15/harness/config/agent-harness.yaml` and `.ff15/harness/projects/{default.yaml,_template.yaml}`.

## Capabilities

### New Capabilities
- `ff15-projects-context-resolver`: Resolves harness configuration source with strict precedence and exposes resolved project/openspec context in a read-only sidebar.

### Modified Capabilities
- None.

## Impact

- Affected extension areas: sidebar view registration, extension activation wiring, resolver services under feature/config layers, and webview UI route/component for Projects.
- Affected runtime behavior: startup/config loading path selection and bootstrap behavior when no harness directory exists.
- Tests: add coverage for resolver precedence, invalid `.agents` error handling, bootstrap generation, and Projects view rendering payload.