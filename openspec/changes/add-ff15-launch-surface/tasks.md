## 1. Sidebar launch surface

- [ ] 1.1 Replace the sample view contributions with a single FF15 launch view in the extension manifest
- [ ] 1.2 Replace the sample webview UI with a minimal FF15 launch surface that can send a launch request to the extension

## 2. Launch orchestration

- [ ] 2.1 Add a launch controller that resolves the active workspace root and validates `zellij` and `opencode`
- [ ] 2.2 Wire the launch controller into extension activation and the FF15 webview provider so the primary action opens Zellij in a VS Code terminal

## 3. Verification

- [ ] 3.1 Add extension-side unit tests for workspace resolution and dependency failure handling
- [ ] 3.2 Add extension-side unit tests for successful terminal launch orchestration and run the targeted validation commands