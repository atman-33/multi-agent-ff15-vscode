## Why

Projects context resolution currently exposes mode/path but does not carry explicit openspec source metadata, and bootstrap output is still v2-shaped. This makes it harder to reason about decoupled `openspec.project_id` flows and to keep compatibility as schema expectations move to v3.

## What Changes

- Extend FF15 Projects context resolver to preserve config version metadata without hard-coding acceptance to specific versions, while keeping v3 as the bootstrap/write baseline.
- Keep `openspec.project_id` independent from `active_projects` in `project` mode and preserve strict profile existence validation.
- Emit openspec source metadata (`sourceProjectId`) in resolver snapshots when `openspec.mode=project`.
- Preserve `harness` mode behavior by resolving openspec path from the owning harness root and setting source project metadata to `null`.

## Capabilities

### New Capabilities
- `ff15-openspec-source-metadata`: Resolves and exposes openspec source metadata with schema-version aware context loading (v2/v3 read compatibility, v3 bootstrap baseline).

### Modified Capabilities
- None.

## Impact

- Affected extension area: `src/features/ff15-projects/context-resolver.ts` and related provider/webview snapshot contracts.
- Affected UI: Projects sidebar OpenSpec section adds source project metadata visibility for project mode.
- Affected tests: resolver and projects-provider tests update to cover v3 bootstrap and source metadata behavior.