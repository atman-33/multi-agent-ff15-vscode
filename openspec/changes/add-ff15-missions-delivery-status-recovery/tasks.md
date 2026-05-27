## 1. Sidebar state projection

- [x] 1.1 Extend the Missions provider payload so the list and composer expose per-mission delivery states for draft, sending, active, and error.
- [x] 1.2 Update the Missions webview UI to render clear delivery-state feedback and only show recovery affordances for errored missions.

## 2. Recovery flow

- [x] 2.1 Add a provider/controller action that retries an errored mission from the same mission context.
- [x] 2.2 Ensure recovery clears stale error state only for the explicit retry attempt and restores error state if resend still fails.

## 3. Verification

- [x] 3.1 Add focused tests for delivery-state rendering, recovery transitions, and resend behavior.
- [x] 3.2 Run the repository validation commands for the touched slice and repo defaults.