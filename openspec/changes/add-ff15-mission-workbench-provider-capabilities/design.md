## Context

Issue #57 moved mission model state under provider-owned storage. Issues #59 and #60 then wired OpenCode model catalogs and provider-specific routing into the Mission Workbench. The remaining gap is that the controller still posts a mostly provider-agnostic roster payload: the mission includes `providerId`, but the webview only gets a generic `modelCatalog` plus one disabled-reason string. That forces the UI to infer which controls should exist and when they should be disabled.

## Goals / Non-Goals

**Goals:**
- Expose provider-aware roster capability state directly from the extension host.
- Keep provider-specific catalog and disabled-reason decisions in the controller and adapter layer, not duplicated in the webview.
- Make unavailable party-roster actions explain themselves in the UI.

**Non-Goals:**
- Renaming the overloaded `effort` field.
- Adding new mission providers.
- Redesigning the broader Mission Workbench layout outside the party roster slice.

## Decisions

- Add an explicit provider capability contract to Mission Workbench state instead of making the webview derive support from catalog presence alone.
  Rationale: the controller already resolves the provider adapter and runtime state, so it is the narrowest place to produce authoritative action availability.
- Keep provider-specific model catalog resolution in the extension host and continue posting only the active provider's catalog to the webview.
  Rationale: model projection already depends on workspace runtime state for OpenCode and static fallback behavior for GitHub Copilot.
- Surface unavailability as reason strings that are ready to render in the party roster UI.
  Rationale: this fixes the current silent or weak feedback path without requiring the webview to reconstruct backend rules.

## Risks / Trade-offs

- [Contract growth] -> The workbench message payload gets larger. Mitigation: keep the capability shape narrow and limited to roster actions.
- [UI drift] -> The webview and extension host can diverge if tests cover only one side. Mitigation: add focused controller and webview-facing tests around the posted state shape.
- [Future provider expansion] -> A minimal capability shape could need extension later. Mitigation: model the payload as action-specific capability entries so new actions can be added without breaking the existing contract.