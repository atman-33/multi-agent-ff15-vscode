## 1. Manifest and activation wiring

- [x] 1.1 Add FF15 Missions view identifiers, manifest contributions, and activation registration alongside the existing Launch and Settings views
- [x] 1.2 Add the Missions view provider that reuses the shared webview shell and routes Missions-specific webview messages into extension-side mission state actions

## 2. Lightweight mission state

- [x] 2.1 Implement a lightweight mission state module backed by workspaceState for create, list, select, and restore behavior
- [x] 2.2 Wire the Missions provider to hydrate mission state on view resolution and push updated mission snapshots back to the webview after mutations

## 3. Missions webview shell

- [x] 3.1 Add an FF15 Missions route to the shared webview app with a compact mission list and create-mission affordance
- [x] 3.2 Add a Noctis composer shell with clear empty and disabled states that follows the active mission selection without implementing transport yet

## 4. Verification

- [x] 4.1 Add focused tests for manifest contributions, activation wiring, mission-state persistence, and Missions provider behavior
- [x] 4.2 Run focused mission-shell tests plus the repository validation commands required for this slice