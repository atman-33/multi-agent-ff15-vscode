## ADDED Requirements

### Requirement: Missions view shows delivery status per mission
The system SHALL surface each mission's delivery state in the Missions view so the user can see when a mission is draft, sending, active, or in error.

#### Scenario: Sidebar reflects mission delivery state
- **WHEN** a mission transitions between draft, sending, active, and error states
- **THEN** the Missions view updates the mission list and composer feedback to show the current delivery state for that mission

### Requirement: Failed missions can be recovered from the sidebar
The system SHALL expose a retry or reconnect action for failed missions in the Missions view that attempts to re-establish delivery and resend from the same mission context.

#### Scenario: Retry a failed mission from the sidebar
- **WHEN** the user triggers recovery for a mission in an error state and delivery can be re-established
- **THEN** the extension retries the send from the same mission context and returns the mission to a sendable or active state

### Requirement: Recovery flow preserves failure visibility when resend still fails
The system SHALL keep a mission in a visible error state when a retry or reconnect attempt still cannot restore delivery.

#### Scenario: Recovery attempt fails again
- **WHEN** the user triggers recovery for a mission in an error state and the resend cannot re-establish delivery
- **THEN** the Missions view keeps the mission in an error state with user-visible failure feedback