## 1. Mission workflow runtime model

- [x] 1.1 Extend the canonical mission runtime record with persisted workflow runtime and probe-verdict metadata for operation-backed missions
- [x] 1.2 Add focused mission-store tests that cover workflow metadata hydration and persistence

## 2. Extension-owned runtime probe and bridge assets

- [x] 2.1 Implement a workspace-scoped operation runtime probe service that starts or reuses mission probes and exposes mission or workflow lookup plus task or report submission entry points
- [x] 2.2 Materialize managed bridge assets under `.ff15/bridge`, including manifest data and PowerShell-first scripts for mission lookup, workflow lookup, task submission, and report submission
- [x] 2.3 Add focused tests for runtime probe reuse, bridge endpoint behavior, and bridge-asset generation

## 3. Mission Workbench integration

- [x] 3.1 Extend the Mission Workbench controller state so operation-backed missions request runtime probing and receive async `starting`, `ready`, and `unavailable` updates
- [x] 3.2 Update the Mission Workbench UI to surface runtime state, probe verdict, and latest workflow or task metadata for the current mission
- [x] 3.3 Add focused tests for workbench runtime state transitions and persisted probe-verdict restoration

## 4. Verification

- [x] 4.1 Run focused tests for the touched mission and operation-runtime slices
- [x] 4.2 Run repository validation commands: `npm run lint`, `npm run test`, and `npm run compile`