## 1. Mission title persistence

- [ ] 1.1 Extend the mission store and mission-title helpers so missions can detect generated default titles, accept validated title updates, and persist renamed titles through the existing runtime record flow.
- [ ] 1.2 Add focused store tests for mission title updates, prompt-title normalization, and default-title detection behavior.

## 2. First-send auto-title behavior

- [ ] 2.1 Update the mission send controller so the first prompt replaces only the generated default mission title with a normalized, length-limited summary while preserving mission runtime identity.
- [ ] 2.2 Add focused controller tests for default-title promotion and the manual-title-preservation path.

## 3. Mission Workbench rename flow

- [ ] 3.1 Add a Mission Workbench rename message flow that edits the mission title, refreshes the posted mission state, and keeps the panel title synchronized.
- [ ] 3.2 Add focused workbench controller and webview tests for mission rename interactions and rendered title updates.

## 4. Verification

- [ ] 4.1 Run focused tests for the touched missions store, send controller, and workbench slices.
- [ ] 4.2 Run the repository validation commands required for the touched files.