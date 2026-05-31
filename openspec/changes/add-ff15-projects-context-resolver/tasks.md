## 1. Resolver and bootstrap foundation

- [ ] 1.1 Add a Projects context resolver service that selects harness root with precedence `.agents/harness` -> `.ff15/harness` -> bootstrap `.ff15/harness`.
- [ ] 1.2 Implement minimum bootstrap file generation for `.ff15/harness/config/agent-harness.yaml` and `.ff15/harness/projects/{default.yaml,_template.yaml}`.
- [ ] 1.3 Add explicit validation/error state for invalid `.agents/harness` with no silent fallback.

## 2. Projects sidebar surface

- [ ] 2.1 Register a new FF15 Projects sidebar view and command IDs in manifest/config constants.
- [ ] 2.2 Implement extension-host provider/controller wiring to load resolver state and expose read-only payload.
- [ ] 2.3 Add webview route/component to render resolved source path, active projects, openspec mode/path, and resolver errors.

## 3. Tests and verification

- [ ] 3.1 Add resolver tests for precedence, bootstrap generation, and invalid `.agents/harness` hard-error behavior.
- [ ] 3.2 Add provider/webview state tests to verify read-only Projects payload rendering.
- [ ] 3.3 Run repository checks (`npm run lint`, `npm run test`, `npm run compile`) and confirm no regressions.