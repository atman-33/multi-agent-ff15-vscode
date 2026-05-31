## Context

The current missions flow stores a visible `title` on every mission record, but new missions always start with a generated `Mission N` label. The mission workbench already owns the main mission-focused UI and the mission send controller already sees the first prompt before delivery, so this change spans the persisted mission store, the send flow, the workbench controller, and the workbench header UI.

## Goals / Non-Goals

**Goals:**
- Let the user rename a mission from the Mission Workbench and persist that title through the existing mission store.
- Promote the first submitted Noctis prompt into the visible mission title when the mission still uses the generated default label.
- Normalize auto-derived titles so long or multi-line prompts remain readable in the sidebar, workbench header, and panel title.
- Preserve mission runtime identity by keeping the existing mission id and session name unchanged when only the visible title changes.

**Non-Goals:**
- Renaming mission ids, session names, output paths, or any other runtime identifiers.
- Building a separate rename flow in the Missions sidebar.
- Inferring titles from worker reports, operation metadata, or later prompts after the initial send decision.

## Decisions

### Extend the mission store patch contract to allow title updates
The mission store SHALL accept a title patch and persist it through the same file-backed mission record flow already used for mission status and operation metadata. This keeps rename behavior consistent across the sidebar snapshot, mission runtime file, and workbench hydration path.

Alternative considered: add a dedicated rename-only persistence API. Rejected because the existing `updateMission` path already owns mission persistence and a separate API would duplicate normalization and eventing behavior.

### Derive automatic titles only from the first send while the mission still uses the default generated label
The send controller SHALL derive a mission title from the submitted prompt only when the current title still matches the generated default pattern. This avoids clobbering user-provided titles and keeps the auto-title feature limited to mission bootstrap rather than turning every send into a rename decision.

Alternative considered: always replace the title on the first successful send regardless of the current title. Rejected because an explicit manual rename before the first send should remain authoritative.

### Normalize prompt-derived titles for UI readability
Automatic titles SHALL trim leading and trailing whitespace, collapse internal whitespace and line breaks to single spaces, and truncate the result to a fixed maximum length before persistence. The same normalization helper can also protect manual rename input from empty or whitespace-only titles.

Alternative considered: store the raw prompt as the title. Rejected because long multi-line prompts would degrade sidebar readability and panel titles.

### Keep workbench panel titles synchronized with persisted mission titles
When a mission title changes, the workbench controller SHALL refresh the open panel title from persisted mission state in addition to posting updated webview state. This makes manual rename and first-send auto-titles visible immediately in the editor chrome.

Alternative considered: update only the webview content and leave the panel title stale until reopen. Rejected because it creates inconsistent mission naming within the same UI surface.

## Risks / Trade-offs

- Title normalization can hide part of a long prompt -> Use a conservative fixed length that preserves the recognizable lead of the prompt while keeping sidebar labels compact.
- Default-title detection based on the generated pattern can be brittle if the seed format changes later -> Centralize default-title generation and detection in shared mission-title helpers.
- Workbench rename UI adds another message path between webview and extension host -> Keep the message contract small and validate string inputs before persisting.

## Migration Plan

No explicit migration is required. Existing missions can keep their current stored titles, and only newly renamed or newly auto-titled missions will persist the updated value.

## Open Questions

- None. The title limit and normalization rules can be implemented directly within this slice.