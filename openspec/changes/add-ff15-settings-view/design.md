## Context

Issue #7 introduced an FF15 launch-client abstraction, but the FF15 sidebar still exposes only a single Launch view. That makes launch and configuration feel like one surface, even though the sibling multi-agent-ff15 project keeps configuration in its own dedicated area. This slice adds a minimal Settings view that acts as a clear configuration entry point without turning the Launch view into a mixed-responsibility surface.

## Goals / Non-Goals

**Goals:**

- Add a dedicated FF15 Settings view to the existing FF15 activity bar container.
- Expose a reusable FF15 command that opens the extension's settings namespace directly in VS Code.
- Keep the Launch view focused on starting FF15 rather than accumulating settings UI.
- Cover the new surface with focused tests around manifest contributions and settings-open behavior.

**Non-Goals:**

- Building an editable settings form inside the sidebar webview.
- Moving existing FF15 launch configuration out of VS Code's native Settings UI.
- Redesigning the existing Launch view beyond removing pressure to add settings controls there.

## Decisions

### Add a second webview-backed sidebar view inside the FF15 container

The extension will contribute a separate Settings view in the same FF15 activity bar container and register its own provider during activation. This keeps the navigation model simple and matches the existing Launch view architecture.

Alternative considered: add a settings button directly into the Launch view. Rejected because it keeps configuration controls inside the launch surface that issue #8 explicitly wants to keep narrow.

### Open settings through a dedicated FF15 command

The extension will contribute a named command that delegates to VS Code's built-in settings-opening command with an FF15-specific query. The Settings view will invoke that command, not the built-in command directly, so manifest contributions and behavior stay explicit and testable.

Alternative considered: have the view provider call VS Code's built-in settings command inline with no extension command. Rejected because it does not satisfy the requirement for an FF15-specific command contribution and makes the behavior harder to reuse or verify.

### Reuse the shared webview shell with a new page id and lightweight route

The existing webview bootstrap already routes on `data-page`, so the Settings view will reuse that shell and add a small route with explanatory copy plus one primary action. This keeps styling and CSP handling consistent with the Launch view.

Alternative considered: render a hand-written HTML string in the provider. Rejected because it would duplicate webview structure and styling logic for a very small gain.

## Risks / Trade-offs

- [Settings query opens the extension's native settings list, not a custom FF15 form] -> Accept this because the issue calls for a direct settings namespace entry point, and native settings stay the source of truth.
- [A second sidebar view adds more activation wiring] -> Keep identifiers centralized and make registration explicit in one place.
- [Tests cannot fully render the VS Code sidebar chrome] -> Verify the manifest contribution shape and the command/provider behavior directly, which covers the observable contract this slice owns.