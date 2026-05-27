## Why

The Missions view can now continue an existing mission, but the sidebar still hides too much state from the user. Issue #15 is needed so the sidebar itself communicates whether a mission is draft, sending, active, or broken, and so a failed mission can be retried from the same view without dropping into logs or manual recovery.

## What Changes

- Surface per-mission delivery status in the Missions sidebar list and composer so mission state changes are visible as the user sends prompts.
- Add a retry or reconnect action for failed or stale missions that re-establishes delivery and resends from the same mission context.
- Keep the recovery flow inside the Missions view rather than requiring the user to inspect logs or recreate the mission manually.
- Add focused tests for mission state rendering, recovery transitions, and resend behavior after reconnection.

## Capabilities

### New Capabilities
- `ff15-missions-delivery-status-recovery`: Show mission delivery state in the sidebar and let the user recover a failed mission from the same view.

### Modified Capabilities

## Impact

- Affected extension-host code includes the missions provider, send controller, session recovery flow, and mission state store.
- Affected webview UI code includes mission list state badges, composer feedback, and recovery controls for errored missions.
- Affected tests include focused coverage for sidebar state transitions and retry or reconnect behavior.