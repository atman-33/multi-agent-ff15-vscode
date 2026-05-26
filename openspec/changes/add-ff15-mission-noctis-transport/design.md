## Context

Issue #12 added the Missions sidebar surface, a workspaceState-backed mission store, and a Noctis composer shell, but it intentionally stopped before transport. The next slice needs to turn the first send action into a live path while staying inside the VS Code extension process and keeping Windows-first constraints.

The current launch flow already knows how to resolve the active workspace root and spawn Zellij, but it does not keep a VS Code terminal handle that can be reused for message delivery. That means issue #13 has to use Zellij's own external control path for both pane lookup and prompt injection instead of trying to reuse the extension terminal APIs.

Local verification also showed that the installed Windows Zellij build supports `write-chars` and `send-keys`, but not the `action paste` command variant that some newer docs mention. The transport contract therefore needs to be pinned to the locally supported command surface rather than a looser "paste or write" assumption.

## Goals / Non-Goals

**Goals:**
- Turn the Missions composer send action into a real extension-host flow for the first prompt.
- Use a deterministic mission-scoped Zellij session name derived from the current workspace root plus mission identity.
- Resolve the Noctis pane for that session through Zellij control commands and deliver the prompt with `write-chars`, a short delay, and `send-keys Enter`.
- Persist mission runtime state under `.ff15/` so the workspace keeps a visible record of session names, agent pane ids, and failure state across extension reloads.
- Surface transport failures back to the Missions view with focused controller and transport tests.

**Non-Goals:**
- Transcript capture, response streaming, or mission history rendering.
- Multi-agent routing beyond the Noctis pane.
- Reconstructing or recovering arbitrary pre-existing mission sessions created outside this extension beyond the mission-scoped session contract managed by `.ff15`.
- Changing the existing FF15 launch surface beyond reusing shared helpers where it is pragmatic.

## Decisions

### Add a dedicated mission send controller above the store and provider

The provider should stay thin. A dedicated controller/service will orchestrate workspace-root resolution, session naming, Zellij launch-or-attach, pane lookup, prompt delivery, and mission-state updates.

- Chosen because the acceptance criteria center on orchestration and error handling, which would otherwise bloat the provider and make tests brittle.
- Alternative considered: embed transport logic directly in the provider. Rejected because it mixes webview messaging with process control and state transitions.

### Extend mission records with runtime transport metadata and user-facing error state

Mission state will be split into two layers:

- a workspace-local canonical mission runtime record at `.ff15/missions/<missionId>/mission.json`
- a lightweight VS Code-managed snapshot used for active selection and backward-compatible hydration

The file-backed mission record stores status, session name, workspace root, last error, and an `agentPanes` map keyed by `noctis`, `ignis`, `gladiolus`, and `prompto`. A successful first send upgrades the mission from `draft` to `active`; failures keep enough context for the UI to explain what broke.

- Chosen because transport metadata is workspace runtime state, not just UI state, and the user needs a visible and shareable place to inspect or recover mission/session bindings.
- Alternative considered: keep mission runtime only in `workspaceState`. Rejected because it hides transport state inside VS Code internals and makes cross-tool inspection or recovery awkward.
- Alternative considered: keep transport state entirely in memory inside the controller. Rejected because reloads and follow-up sends would lose the session binding.

### Use deterministic Zellij session names and pane discovery through external commands

The transport will derive a stable session name from the workspace root plus mission id, ensure the session exists, then use `zellij action list-panes --json` scoped to that session to resolve the Noctis pane. The mission record will cache agent-to-pane ids for all FF15 agents; issue #13 only requires Noctis to be resolved for live sending, so other agent pane slots may remain `null` until later slices provision them.

Prompt delivery will use `zellij --session <name> action write-chars --pane-id <pane> <text>`, wait a short interaction delay, and then use `zellij --session <name> action send-keys --pane-id <pane> Enter`.

- Chosen because the current Windows launch path does not preserve a reusable terminal object and the issue explicitly requires Zellij's external control surface.
- Alternative considered: use `action paste` for prompt delivery. Rejected because the installed Windows Zellij build used by the extension does not expose that subcommand.
- Alternative considered: keep a hidden VS Code terminal per mission and send text through that handle. Rejected because it violates the acceptance criteria and remains fragile across reloads.

### Treat cached pane ids as hints and revalidate them against `list-panes`

The stored `agentPanes` map should speed up later sends and make runtime state inspectable, but pane ids are not assumed to be permanently valid. Each send flow should reconcile the cached pane ids with the current `list-panes --json` output before using them, refreshing the mission record when Zellij returns a different pane id.

- Chosen because pane ids can change when sessions are recreated or panes are reopened.
- Alternative considered: trust stored pane ids blindly. Rejected because stale pane ids would turn every later send into a hard-to-diagnose failure.

### Surface transport outcomes through explicit provider messages

The webview should send a new message for Noctis prompt submission. The provider forwards that request into the controller and then posts the updated mission snapshot back to the webview, including any send-in-progress or failure state already stored in mission state.

- Chosen because it preserves the existing provider-to-webview snapshot model from issue #12.
- Alternative considered: return ad hoc one-off error messages without putting them in mission state. Rejected because the sidebar needs stable state after rerenders and reloads.

## Risks / Trade-offs

- [Zellij pane metadata may vary across versions] -> Keep pane matching narrow and test the parser against realistic JSON fixtures instead of assuming one ordering.
- [Workspace-root-derived session names may collide or contain invalid characters] -> Normalize and bound the generated name before launch and persist the exact resolved name in mission state.
- [Transport failures can leave partially initialized mission state] -> Apply state transitions in a clear order and persist explicit failure metadata instead of silently abandoning the mission.
- [`.ff15` runtime files live inside the workspace] -> Keep the layout minimal, document that it is generated state, and ignore it from git when the workspace root is a repository.
- [Cached pane ids may drift from actual Zellij state] -> Reconcile cached ids against `list-panes` on every send and rewrite the mission record when the mapping changes.
- [First-send orchestration crosses multiple modules] -> Keep the controller small, inject process-running dependencies, and cover the orchestration with focused unit tests.