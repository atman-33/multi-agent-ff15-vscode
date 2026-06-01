## 1. Mission State And Contract

- [x] 1.1 Add mission-scoped per-agent model state with normalization and fallback behavior.
- [x] 1.2 Add OpenCode model catalog master data with model-scoped effort options and no-effort support.

## 2. Extension Host Routing

- [x] 2.1 Project fixed party roster state from mission records into Mission Workbench state.
- [x] 2.2 Route raw Continue actions to the selected live agent pane and refresh workbench state.
- [x] 2.3 Route model-change actions through the approved OpenCode `/model` input sequence and persist successful selections.

## 3. Webview UI

- [x] 3.1 Add a bottom Mission Workbench party roster with fixed FF15 agent cards, pane availability, and current model display.
- [x] 3.2 Add shadcn context-menu actions for raw Continue and per-agent model controls with enabled and disabled states.

## 4. Validation

- [x] 4.1 Add focused extension-host tests for roster projection, persistence, Continue routing, and model-scoped effort routing.
- [x] 4.2 Add focused webview tests or type-level UI contract coverage for enabled and disabled roster actions.
- [x] 4.3 Run repository-defined validation checks.