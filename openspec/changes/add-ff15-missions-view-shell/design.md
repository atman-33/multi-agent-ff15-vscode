## Context

The FF15 sidebar already uses a webview-backed Launch view and a separate Settings view, both wired through explicit providers that stay thin and delegate behavior to focused modules. Issue #12 adds a third surface, but it intentionally stops before real Zellij delivery. That means this slice still needs a usable mission-oriented shell while keeping message transport, transcript history, and mission runtime recovery for follow-up issues.

Because the extension is self-contained and Windows-first, this slice should not depend on the sibling multi-agent-ff15 mission store or server routes. The state only needs to support lightweight mission records that are local to the current workspace and can survive extension reloads.

## Goals / Non-Goals

**Goals:**
- Contribute a dedicated Missions view inside the existing FF15 activity bar container.
- Keep Missions aligned with the existing shared webview shell and explicit provider registration model.
- Persist lightweight mission records and the active mission selection through extension-managed workspace state.
- Render a Noctis composer shell in the Missions view with clear empty and disabled states while transport is still out of scope.
- Cover manifest wiring, provider behavior, and mission-state persistence with focused tests.

**Non-Goals:**
- Sending messages to Zellij or creating mission-scoped Noctis sessions.
- Managing mission transcripts, runtime status, or recovery behavior beyond the local shell state.
- Reproducing the full multi-agent-ff15 mission store, routing model, or API surface.
- Adding rename, archive, delete, or bulk mission operations in this slice.

## Decisions

### Add Missions as a third dedicated FF15 sidebar view

The extension will contribute a separate Missions webview view alongside Launch and Settings, and activation will register an explicit Missions view provider.

- Chosen because issue #12 is about a new mission workspace surface, not adding more controls to Launch.
- Alternative considered: embed missions UI into the Launch view. Rejected because it mixes launch orchestration with mission authoring and immediately makes Launch a mixed-responsibility surface.

### Persist lightweight mission records in workspaceState

Mission records for this slice will live in extension-host state backed by `ExtensionContext.workspaceState`. Each record only needs a stable id, title, timestamps, and selection metadata for the shell experience.

- Chosen because issue #12 needs persistence across reloads without introducing a file format, external runtime, or sibling-repository dependency.
- Alternative considered: store missions in webview local storage. Rejected because it would make provider-owned behavior harder to test and would not give the extension host a canonical source of truth.
- Alternative considered: adopt the sibling multi-agent-ff15 mission store structure now. Rejected because this slice does not need runtime transport fields and must stay self-contained in this repository.

### Keep provider messaging thin and move mission-state logic into a dedicated module

The Missions view provider should translate webview messages into mission-state actions and push state snapshots back to the view. Mission creation, selection, hydration, and persistence should live in a dedicated extension-side store/service module.

- Chosen because it matches the existing Launch and Settings provider pattern while creating a deeper module that later issues can extend with transport metadata.
- Alternative considered: keep all mission state in the provider class. Rejected because it would mix persistence, mutation logic, and webview messaging in one brittle place.

### Reuse the shared webview shell with a dedicated Missions route

The Missions view will continue routing through `data-page`, adding a dedicated Missions route inside `webview-ui` instead of hand-writing HTML in the provider. The route will render a compact mission list and a disabled Noctis composer shell in a single sidebar-friendly layout.

- Chosen because the shared shell already handles CSP-safe bootstrap and route selection, and the mission shell needs the same styling and message bridge patterns as existing views.
- Alternative considered: repurpose the dormant `interactive` route without renaming the page contract. Rejected because the issue deserves FF15-specific identifiers and tests, not a renamed boilerplate surface hiding under a generic page id.

## Risks / Trade-offs

- [Sidebar width is narrow for both mission list and composer] -> Keep the initial UI intentionally compact, prioritize clear empty states, and defer transcript/history affordances to follow-up issues.
- [WorkspaceState schema may evolve in later mission transport slices] -> Store a small, explicit record shape that can be extended compatibly instead of copying the full mission model now.
- [A new view adds more activation and manifest wiring] -> Centralize identifiers and keep activation tests focused on the observable registration contract.
- [Users may expect the composer send action to work immediately] -> Make the composer shell state explicit in the copy and keep send behavior out of scope until the transport issue lands.