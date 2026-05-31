## Context

The Projects editing flow already has a central workbench panel with provider-owned snapshot loading and controller-owned autosave. External edits to `agent-harness.yaml` or any `projects/*.yaml` file currently bypass that flow entirely, so the UI can drift away from disk and the debounced save can overwrite external changes without a user decision.

The change spans both the extension host and the webview:
- the extension host must watch the resolved Projects config/profile files and decide whether to auto-apply or hold the new snapshot,
- the workbench controller must distinguish between a clean editor and a dirty draft,
- the webview must expose explicit conflict actions before any external snapshot is applied over pending local work.

## Goals / Non-Goals

**Goals:**
- Refresh the Projects editor automatically when the watched config/profile files change and there is no pending local draft.
- Detect conflict cases while a local draft is pending, cancel silent autosave, and surface explicit resolution actions.
- Keep watcher setup scoped to the resolved Projects source instead of adding global repository-wide file listeners.
- Cover watcher refreshes and each conflict branch with focused controller tests.

**Non-Goals:**
- Editing project profile file contents from the Projects editor.
- Adding sidebar-level conflict editing; the conflict UX belongs to the Projects workbench.
- Building a general-purpose merge UI for YAML conflicts.

## Decisions

1. Keep external-change orchestration in the Projects workbench controller.
   - Why: the controller already owns autosave timers, snapshot posting, and panel lifecycle, so it is the narrowest place to add watcher-driven refresh and conflict suspension.
   - Alternative considered: move watchers into the sidebar provider and broadcast into the workbench. Rejected because conflict handling depends on workbench draft state that the provider does not own.

2. Watch the resolved harness source path, not the whole workspace.
   - The watcher will target `config/agent-harness.yaml` plus the `projects/` directory under the resolved `.agents/harness` or `.ff15/harness` source path.
   - Why: the issue only concerns Projects config/profile files, and the resolved source path already exists in the snapshot contract.
   - Alternative considered: watch the full workspace root. Rejected because it would add noise and unnecessary refreshes.

3. Treat “pending local edits” as any in-memory draft that differs from the last accepted snapshot.
   - On an external change with no pending local edits, the controller resolves a fresh snapshot and posts it immediately.
   - On an external change with pending local edits, the controller cancels the pending autosave timer, stores the external snapshot, and posts a conflict event instead of applying it.
   - Why: this is the smallest rule that covers both debounce-window edits and failed-save retry states.

4. Model the conflict UI as three explicit controller actions.
   - `reload`: replace the editor state with the latest external snapshot.
   - `discard-local`: revert the editor to the last accepted snapshot and drop the pending local draft without applying the queued external snapshot.
   - `keep-local`: keep the current draft and resume autosave from the local draft so any overwrite is explicit.
   - Alternative considered: apply the external snapshot for both `reload` and `discard-local`. Rejected because it makes two user choices indistinguishable in behavior.

## Risks / Trade-offs

- [Risk] File watchers may emit duplicate events for one external save.
  → Mitigation: resolve and post the latest snapshot idempotently; tests should assert observable outcomes, not event counts.

- [Risk] `discard-local` can intentionally leave the editor stale relative to disk until the next change or reopen.
  → Mitigation: show an explicit status message that local edits were discarded and the queued external state was not applied.

- [Risk] `keep-local` resumes a save that may overwrite newer on-disk changes.
  → Mitigation: only resume autosave after the user explicitly chooses `keep-local`.

## Migration Plan

1. Extend the workbench controller with watcher lifecycle management, local-draft tracking, and conflict-resolution messages.
2. Extend the Projects workbench route with conflict UI and resolution message posting.
3. Add focused controller tests for auto-refresh and the `reload`, `discard-local`, and `keep-local` branches.
4. Run focused tests, then repository validation (`npm run lint`, `npm run test`, `npm run compile`).

## Open Questions

- No open product questions; the issue text already fixes the required conflict choices.