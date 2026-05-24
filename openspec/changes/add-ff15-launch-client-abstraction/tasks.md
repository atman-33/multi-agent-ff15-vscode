## 1. Launch client selection and contract

- [x] 1.1 Add FF15 launch-client types and implementations for GitHub Copilot CLI and OpenCode, with GitHub Copilot CLI as the default selection
- [x] 1.2 Add VS Code configuration wiring that resolves the selected FF15 launch client before controller launch begins

## 2. Controller and layout refactor

- [x] 2.1 Refactor the FF15 launch controller to validate `zellij` plus only the selected launch client's requirements and to delegate provider-specific behavior through the launch-client contract
- [x] 2.2 Update the bundled roster layout rendering to consume a provider-independent pane launch plan instead of a hardcoded OpenCode executable placeholder

## 3. Verification

- [x] 3.1 Add focused tests for default client selection, dependency validation, pane launch-plan rendering, and controller launch behavior
- [x] 3.2 Run the focused FF15 launch tests and `npm run compile`