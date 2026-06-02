## 1. Mission State Pinning

- [ ] 1.1 Persist a mission-owned `providerId` on newly created mission records.
- [ ] 1.2 Keep canonical mission persistence and normalization aligned with the new provider field.

## 2. Runtime Provider Resolution

- [ ] 2.1 Update mission session launch and reopen flows to resolve the launch client from the mission-owned provider.
- [ ] 2.2 Update mission send flows to resolve the launch client from the mission-owned provider instead of the live workspace setting.

## 3. Validation

- [ ] 3.1 Add focused tests for provider pinning in mission state, send/session controllers, and VS Code mission wiring.
- [ ] 3.2 Run repository validation for the slice with focused mission tests plus root lint, full tests, and compile.