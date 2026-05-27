## Context

Issue #14 established the continuation path for existing missions, but the Missions view still relies on the user inferring transport state from sparse status text and background behavior. Issue #15 adds explicit delivery-state feedback and a same-view recovery action so a failed mission can transition back into a sendable state without forcing the user to create a new mission.

The current architecture already persists mission status in the store and routes webview events through the missions provider into controller methods. The missing piece is a user-facing recovery path that can reset an errored mission, reuse the same mission context, and surface its transient states in the list and composer.

## Goals / Non-Goals

**Goals:**
- Reflect per-mission delivery state clearly in the sidebar for draft, sending, active, and error missions.
- Add a retry or reconnect action for failed missions that resends from the same mission context.
- Keep recovery logic aligned with the existing mission send and transport abstractions rather than creating a parallel flow.
- Cover the state transition and recovery path with focused provider and controller tests.

**Non-Goals:**
- Add richer delivery analytics, timestamps, or transport diagnostics beyond the state needed for issue #15.
- Change the mission transport contract beyond what is required to retry or reconnect from the sidebar.
- Introduce separate mission history or transcript UI.

## Decisions

### Reuse the existing mission send controller as the recovery entry point
Recovery SHALL reuse the existing send flow instead of introducing a dedicated transport-only reconnect pipeline. This keeps state transitions and resend behavior in one place and avoids diverging rules for session validation.

Alternative considered: add a separate reconnect command that only repairs transport state. Rejected because the acceptance criteria explicitly ask for recovery that attempts to re-establish delivery and resend from the same mission context.

### Expose mission state and recovery affordances through provider-backed view state
The Missions provider SHALL project mission status and recovery actions into the webview state so the list and composer can render consistent feedback. This keeps the UI declarative and anchored to the existing store snapshot.

Alternative considered: compute recovery affordances entirely inside the webview. Rejected because the extension host already owns the source-of-truth mission state and transport decisions.

### Recover failed missions by clearing stale error state only around an explicit retry
The retry action SHALL clear the visible error as part of a fresh send attempt, but only when the user explicitly triggers recovery. This preserves failure visibility while still allowing the same mission to return to sending and active states.

Alternative considered: auto-clear mission errors whenever the sidebar rehydrates. Rejected because it hides failures without confirming that delivery can actually succeed again.

## Risks / Trade-offs

- Recovery UI can become noisy if every mission exposes too much chrome -> Restrict retry or reconnect affordances to missions in an error state.
- Resend behavior may duplicate prompts if the recovery action loses track of the pending input -> Keep recovery attached to the same composer-driven send path and cover the transition with focused tests.
- Provider and webview state can drift if status labels are computed in two places -> Centralize delivery-state projection in the provider payload.