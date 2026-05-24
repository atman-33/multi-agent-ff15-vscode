## 1. Manifest and activation wiring

- [x] 1.1 Add FF15 settings command and sidebar view contributions to the extension manifest and shared identifier constants
- [x] 1.2 Register the FF15 settings command and settings view provider during extension activation

## 2. Settings view implementation

- [x] 2.1 Implement the FF15 settings-opening command that delegates to VS Code's settings UI with the FF15 extension query
- [x] 2.2 Add the Settings view provider and sidebar webview route with a minimal call-to-action for opening FF15 settings

## 3. Verification

- [x] 3.1 Add focused tests for manifest contributions, settings command execution, and settings view message handling
- [x] 3.2 Run the focused FF15 settings tests and `npm run compile`