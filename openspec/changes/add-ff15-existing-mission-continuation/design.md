## Context

Issue #13 added file-backed mission runtime records and prompt delivery through Zellij external control, but the implementation still centers on creating or refreshing a mission transport during the first send path. Issue #14 extends that slice so a mission restored from `.ff15/missions/<missionId>/mission.json` can keep enough transport metadata to continue an existing Noctis conversation after the extension reloads.

The current extension already persists mission session names and pane bindings. The remaining gap is deciding when that persisted state is trustworthy, how the controller should reuse it for an existing mission, and how to fail when the stored session no longer maps to a live Noctis pane.

## Goals / Non-Goals

**Goals:**
- Preserve the metadata required to target a previously created Noctis pane across extension reloads.
- Reuse the mission-scoped Zellij session for follow-up prompts sent from a restored mission.
- Surface a recoverable user-facing error instead of silently creating a new mission session when the stored Noctis pane is stale.
- Keep the behavior covered by focused controller, state, and transport tests.

**Non-Goals:**
- Rebuild or migrate old mission runtime files beyond the fields needed for continuation.
- Add automatic self-healing that launches a replacement Noctis pane when continuation fails.
- Expand the Missions UI beyond the status and error behavior needed for continued sends.

## Decisions

### Rehydrate continuation metadata from the existing mission runtime record
The controller SHALL treat `.ff15/missions/<missionId>/mission.json` as the source of truth for session-scoped continuation metadata after reload. This keeps persisted session names and pane bindings aligned with the file-backed runtime already introduced for missions.

Alternative considered: rebuild continuation metadata from workspaceState on activation. Rejected because workspaceState is now a sidebar snapshot, not the canonical runtime source, and it is easier for the file-backed mission record to survive reloads consistently.

### Reuse an existing mission session before considering any new launch path
When the user sends another prompt for a stored mission, the controller SHALL resolve the stored Zellij session and reconcile the stored Noctis pane binding against the live pane list before sending text. This preserves the same Noctis conversation and avoids accidentally splitting a mission across multiple sessions.

Alternative considered: always create a fresh mission session for follow-up prompts. Rejected because it breaks the mission continuity contract and discards the existing conversation context.

### Treat stale pane resolution as a recoverable mission error
If the stored session no longer exposes a live Noctis pane, the controller SHALL leave the mission in an error state with a recoverable message instead of silently recreating the pane. This matches the acceptance criteria and keeps the failure visible to the user.

Alternative considered: transparently create a replacement Noctis pane. Rejected because it hides a broken continuation path and can route the next prompt into a new conversation that no longer matches the stored mission history.

## Risks / Trade-offs

- Stored pane ids can go stale after Zellij restarts or manual session changes -> Reconcile cached bindings against live pane data before sending, and fail cleanly when no matching Noctis pane remains.
- Runtime files may lag behind the sidebar snapshot after reload -> Rehydrate sidebar mission state from the file-backed runtime before existing-mission sends.
- Blocking automatic recreation may feel stricter than the new-mission path -> Keep the error user-facing and recoverable so the user can deliberately start a fresh mission when continuation is no longer possible.