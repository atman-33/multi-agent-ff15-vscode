## 1. Operation-backed send activation

- [x] 1.1 Add an operation-definition loader that reads the selected workspace-local operation and derives initial-step metadata needed for the first send
- [x] 1.2 Update the mission send controller so operation-backed sends activate and persist canonical workflow step metadata before prompt delivery

## 2. Operation-aware prompt delivery

- [x] 2.1 Shape the Noctis prompt with operation and active-step context while keeping the transport layer unchanged
- [x] 2.2 Add focused tests for operation-backed activation and operation-aware prompt delivery

## 3. Verification

- [x] 3.1 Run focused tests for the touched mission send and operation-loading slices
- [x] 3.2 Run repository validation commands: `npm run lint`, `npm run test`, and `npm run compile`