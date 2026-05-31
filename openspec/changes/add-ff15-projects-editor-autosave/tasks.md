## 1. Resolver and config save foundation

- [ ] 1.1 Extend the Projects context snapshot with known profile catalog data and warning-only diagnostics.
- [ ] 1.2 Add a YAML document save helper for `agent-harness.yaml` that preserves comments/key order, normalizes `active_projects`, and validates `openspec.mode` plus `openspec.project_id` integrity.
- [ ] 1.3 Add focused resolver/save-helper tests for profile catalog loading, warning classification, normalization, and invalid project-mode rejection.

## 2. Provider save orchestration

- [ ] 2.1 Add Projects provider message handling for draft updates, debounced auto-save, and rollback to the last valid snapshot on save failure.
- [ ] 2.2 Add provider tests for debounce behavior, successful refresh after save, and rollback/error posting when `openspec.project_id` is unknown.

## 3. Editable Projects UI and validation

- [ ] 3.1 Replace the read-only Projects route with editable controls for active projects and OpenSpec selection, including warning and save-status messaging.
- [ ] 3.2 Run focused tests for the touched Projects slice, then run `npm run lint`, `npm run test`, and `npm run compile`.