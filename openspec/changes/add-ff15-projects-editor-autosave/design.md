## Context

Issue #45 and #46 established a read-only Projects sidebar that resolves FF15 session context from `.agents/harness` or `.ff15/harness`. Issue #47 turns that surface into an editor for the session config file itself, so the extension must both expose the editable project catalog and persist config changes safely without pushing users out to the file system.

The change crosses three layers:
- the resolver must return enough structured data to render editable selectors and warning-only diagnostics,
- the provider must own save orchestration and rollback semantics,
- the webview must expose simple form controls without requiring an explicit Save button.

The write path is constrained by the existing `agent-harness.yaml` file format. Comments and key order are part of the authored file, so a plain parse/stringify replacement would be noisy and would erase useful context.

## Goals / Non-Goals

**Goals:**
- Expose all known project profiles to the Projects view so `active_projects` and `openspec.project_id` can be edited in-place.
- Auto-save draft changes after a short debounce window in the extension host and refresh the Projects snapshot after each accepted save.
- Preserve YAML comments and key ordering when updating `agent-harness.yaml`.
- Treat schema/id integrity problems as save-blocking errors, while surfacing missing path/default-check data as warnings only.
- Roll back the UI to the last valid saved snapshot when a project-mode save references an unknown profile id.

**Non-Goals:**
- Editing project profile files under `harness/projects`.
- Migrating or rewriting the broader `agent-harness` schema comments.
- Adding explicit save/discard commands to the Projects view.

## Decisions

1. Extend the Projects snapshot with an editable project catalog and warning diagnostics.
   - The resolver will enumerate `harness/projects/*.yaml`, parse profile ids, and expose a stable list of known profiles to the webview.
   - Each profile entry can carry warning-only diagnostics for missing `openspec_root`, missing repo roots, or missing `default_checks`, but those warnings do not block the overall snapshot.
   - Alternative considered: let the webview inspect the file system directly. Rejected because the extension host already owns workspace access and typed validation.

2. Add a dedicated config-update helper that edits the YAML document in place.
   - The helper will use `yaml` document APIs to update `active_projects`, `openspec.mode`, and `openspec.project_id` while preserving untouched comments and map ordering.
   - `active_projects` will be normalized to a deduplicated, lexicographically sorted list before write.
   - Integrity validation will stay narrow: invalid config shape, invalid mode, or unknown `openspec.project_id` in `project` mode fail the save; path/default-check issues become warnings only.
   - Alternative considered: rebuild the whole config via `parse` + `stringify`. Rejected because it would drop comments and authored ordering.

3. Keep debounce and rollback orchestration in the provider.
   - The webview will send draft updates immediately as the user changes controls.
   - The provider will debounce writes for about 400ms, persist the latest draft, and then post either a refreshed ready snapshot or an error event plus the last valid snapshot.
   - Alternative considered: debounce only in React. Rejected because provider-side debounce is easier to test in the current Node-only Vitest setup and keeps save authority in the extension host.

4. Preserve decoupling between `active_projects` and `openspec.project_id`.
   - Saving `active_projects` will not auto-correct `openspec.project_id`, even if that id is no longer active.
   - This matches issue #46 and the new requirement to avoid auto-switching/correction.

## Risks / Trade-offs

- [Risk] Project profile parsing may fail on malformed profile files and hide otherwise valid choices.
  → Mitigation: treat malformed/missing optional fields as per-profile warnings where possible, and reserve hard failure for missing/invalid ids needed by the saved config.

- [Risk] Provider-managed debounce introduces timer complexity in tests and disposal paths.
  → Mitigation: keep a single pending timer, clear it before scheduling the next save, and cover the behavior with fake-timer provider tests.

- [Risk] YAML document mutations could still reorder newly inserted keys when missing sections are created.
  → Mitigation: update existing nodes in place when present and create missing keys in the canonical `version`, `active_projects`, `openspec` order when bootstrapping sparse configs.

## Migration Plan

1. Extend resolver output/tests with project catalog and warning diagnostics.
2. Add YAML document update helper and save validation tests.
3. Add provider-side debounced save flow with rollback/error events.
4. Replace read-only Projects cards with editable controls bound to the new snapshot shape.
5. Run focused tests, then `npm run lint`, `npm run test`, and `npm run compile`.

Rollback: revert the new snapshot fields, save helper, provider message handling, and Projects route editor controls.

## Open Questions

- No open questions for this slice. The issue acceptance criteria are specific enough to implement directly.