## 1. Bundled operations catalog

- [ ] 1.1 Package builtin operation assets with the extension and add a managed `.ff15/operations` materialization module with manifest-driven refresh behavior
- [ ] 1.2 Add an operations catalog loader that reads the managed workspace-local assets and classifies bundled operations as supported or unsupported for the current FF15 roster

## 2. Mission runtime and workbench host wiring

- [ ] 2.1 Extend the canonical mission runtime record to persist the selected `operationRef` and any display metadata needed to restore the Mission Workbench selection
- [ ] 2.2 Add a Mission Workbench host controller that opens or focuses a mission-scoped editor-area webview panel from mission create or select actions

## 3. Sidebar and workbench UI

- [ ] 3.1 Add a Mission Workbench webview route and message bridge that shows mission context, mission status, terminal reopen affordance, and the operations catalog
- [ ] 3.2 Update the Missions sidebar provider and route so create or select actions open the Mission Workbench and the sidebar remains a mission list plus status navigator
- [ ] 3.3 Wire operation selection in the Mission Workbench to persist the mission's selected `operationRef` and surface unsupported operations with explicit reasons

## 4. Verification

- [ ] 4.1 Add focused tests for bundled operation materialization, catalog support classification, and mission `operationRef` persistence
- [ ] 4.2 Add focused tests for Mission Workbench open or focus behavior, sidebar navigation flow, and workbench operation presentation
- [ ] 4.3 Run the repository validation commands required for this slice