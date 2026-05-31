## 1. Resolver contract updates

- [ ] 1.1 Extend `Ff15ProjectsContextSnapshot` ready payload with `configVersion` and `openspec.sourceProjectId`.
- [ ] 1.2 Accept config `version` values 2 and 3 with explicit error for unsupported values.
- [ ] 1.3 In project mode, keep `openspec.project_id` independent from `active_projects` and fail explicitly when profile is missing.

## 2. Bootstrap and mode semantics

- [ ] 2.1 Update bootstrap config writer to emit `version: 3`.
- [ ] 2.2 Preserve harness mode path resolution from the harness owner root and set `openspec.sourceProjectId` to `null`.

## 3. Surface and validation

- [ ] 3.1 Update projects provider/webview type contracts to consume new metadata fields.
- [ ] 3.2 Add/extend tests for v2/v3 compatibility, missing project profile errors, and source metadata behavior.
- [ ] 3.3 Run repository checks (`npm run lint`, `npm run test`, `npm run compile`).