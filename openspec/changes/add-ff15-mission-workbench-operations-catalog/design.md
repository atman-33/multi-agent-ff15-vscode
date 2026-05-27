## Context

The extension already has three FF15 sidebar surfaces backed by a shared webview shell: Launch, Missions, and Settings. Missions also already owns a file-backed mission runtime under `.ff15/missions/<missionId>/mission.json`, plus provider and controller seams for mission selection, session lifecycle, and prompt delivery. What is still missing is the first operation entry surface: there is no workspace-local bundled operations catalog and no editor-area mission surface that can own operation selection without overloading the narrow sidebar.

This slice must stay self-contained in `multi-agent-ff15-vscode`. It can use multi-agent-ff15 as implementation reference, but it cannot depend on the sibling repository at runtime. The extension also stays Windows-first and preserves the current four-agent roster of Noctis, Ignis, Gladiolus, and Prompto.

## Goals / Non-Goals

**Goals:**
- Materialize bundled builtin operation definitions into the active workspace under `.ff15/operations` with managed refresh behavior.
- Expose a mission-facing operations catalog that distinguishes supported versus unsupported bundled operations for the extension's initial roster.
- Open a dedicated Mission Workbench in the editor area from mission create/select actions and make it the primary operation-entry surface.
- Persist the selected `operationRef` on the mission record so mission workflow identity survives reloads and re-open flows.
- Reuse the existing shared webview shell, thin-provider pattern, and file-backed mission runtime wherever practical.

**Non-Goals:**
- Starting the operation engine, bridge scripts, worker dispatch, or report-driven transitions.
- Full browser-app parity for operations authoring, preview, or debug tooling.
- Support for agents outside the current four-agent roster in this slice.
- Replacing the current mission session transport model.
- Rich mission transcript or history UX in the Mission Workbench.

## Decisions

### Materialize bundled builtin operations into a managed workspace-local catalog

The extension will package builtin operation YAML assets and copy them into a managed runtime area under `.ff15/operations` for the active workspace. A small manifest in that managed area will let the extension refresh bundled files when the packaged asset set changes without rewriting unrelated `.ff15/missions` data or other workspace-local runtime files.

- Chosen because issue #21 explicitly needs inspectable workspace-local operation assets while keeping runtime self-contained in this repository.
- Alternative considered: read packaged assets directly from the extension install and skip workspace materialization. Rejected because it hides the runtime source from the user and does not satisfy the workspace-local `.ff15` contract.
- Alternative considered: vendor the sibling repository's builtins directory at runtime. Rejected because the slice must not depend on the sibling repository being present.

### Classify bundled operations as supported or unsupported at catalog load time

The catalog loader will parse each bundled operation definition and mark it as supported only when its declared step agents and runtime assumptions fit the extension's current roster and issue #21 scope. Unsupported operations remain visible in the catalog with an explicit reason instead of silently disappearing.

- Chosen because the issue requires clear communication about unsupported bundled operations while preserving upstream operation visibility.
- Alternative considered: filter unsupported operations out entirely. Rejected because users would not know whether an operation is unavailable by design or missing by mistake.
- Alternative considered: treat all bundled operations as selectable and fail on first use. Rejected because it pushes compatibility errors too late and violates the acceptance criteria.

### Add a Mission Workbench as a WebviewPanel managed per mission

The editor-area Mission Workbench will be implemented as a dedicated `WebviewPanel` surface keyed by mission id. Sidebar actions for mission creation or selection will open or focus that panel rather than embedding the full operation-entry UI inside the Missions sidebar.

- Chosen because a `WebviewPanel` naturally occupies the editor area, can be opened or focused from the sidebar, and fits the issue's requirement for a dedicated mission workbench.
- Alternative considered: keep all controls inside the sidebar. Rejected because the current narrow layout is the problem this issue is meant to solve.
- Alternative considered: use a custom editor or virtual document. Rejected because the workbench is an extension-owned control surface, not a file-backed document the user edits directly.

### Reuse the shared webview shell and keep host adapters thin

The Mission Workbench will reuse `getWebviewContent` and add a dedicated page id in `webview-ui`. Extension-host classes will stay thin: the sidebar provider handles mission navigation, the panel controller manages open or focus behavior, and dedicated modules own operations catalog loading plus mission-record persistence.

- Chosen because this matches the existing architecture and creates deeper modules that later operation-engine slices can extend.
- Alternative considered: hand-build HTML or push all logic into a single panel class. Rejected because it would duplicate existing shell bootstrapping and mix state, transport, and rendering responsibilities.

### Persist selected operation identity on the canonical mission runtime record

The mission runtime record under `.ff15/missions/<missionId>/mission.json` will be extended to store the selected `operationRef` and enough display metadata to restore the current selection when the Mission Workbench reopens. The sidebar and workbench will both read from the same mission source of truth.

- Chosen because selected operation identity is mission runtime state, not ephemeral UI state.
- Alternative considered: keep operation selection only in panel-local state or `workspaceState`. Rejected because it would break continuation and split the source of truth away from the canonical mission record.

## Risks / Trade-offs

- [Managed operation refresh could overwrite user-inspected runtime files unexpectedly] -> Limit refresh to the extension-managed `.ff15/operations` area and use a manifest-driven sync that leaves unrelated mission runtime files alone.
- [Sidebar and Mission Workbench state can drift] -> Keep mission selection and selected `operationRef` in the canonical mission store, and have both surfaces project from the same snapshot.
- [Compatibility checks may reject operations that become valid in later slices] -> Make unsupported status explicit and reasoned so later slices can relax the validator without changing the catalog contract.
- [A new editor-area panel adds more activation wiring and focus state] -> Centralize open or focus behavior in a dedicated controller and cover it with focused activation and controller tests.

## Migration Plan

No external migration is required. Existing mission records that do not yet contain operation metadata remain valid and will continue to hydrate with a null operation selection until the user chooses an operation.

## Open Questions

- None for this slice. Operation engine startup, bridge scripts, and worker dispatch are intentionally deferred to follow-up issues.