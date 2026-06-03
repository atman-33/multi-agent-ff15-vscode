## 1. Catalog discovery and adapter wiring

- [x] 1.1 Add a workspace-scoped OpenCode model catalog refresh/cache service based on `opencode models --verbose`.
- [x] 1.2 Wire Mission Workbench and agent actions through the discovered OpenCode catalog and degraded catalog state instead of the static OpenCode list.

## 2. Workbench degradation UX

- [x] 2.1 Surface a roster model-control disabled reason when OpenCode catalog refresh fails without a usable snapshot, while keeping Continue available.
- [x] 2.2 Render the discovered OpenCode model entries and stale-state behavior in the Mission Workbench UI.

## 3. Validation

- [x] 3.1 Add focused tests for catalog parsing/caching, OpenCode workbench projection, and degraded model-control behavior.
- [x] 3.2 Run focused mission tests, then root `npm run lint`, `npm run test`, and `npm run compile`.