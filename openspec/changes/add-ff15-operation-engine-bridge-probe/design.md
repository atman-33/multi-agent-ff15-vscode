## Context

The extension now has a Mission Workbench, bundled operations catalog materialized under `.ff15/operations`, and canonical mission runtime records stored under `.ff15/missions/<missionId>/mission.json`. What it still lacks is the first extension-owned runtime surface for operation-backed missions: there is no engine lifecycle to attach to, no bridge scripts for local agent panes, and no persisted probe verdict to tell later slices whether this transport is viable.

Issue #22 is intentionally a HITL architectural probe. It must stay self-contained in `multi-agent-ff15-vscode`, remain Windows-first, and avoid any runtime dependency on the sibling `multi-agent-ff15` repository. The goal is not full operation execution yet; the goal is to prove or reject the extension-host bridge contract early while keeping the Mission Workbench contract stable.

## Goals / Non-Goals

**Goals:**
- Start or attach to an extension-owned runtime probe for operation-backed missions.
- Surface `starting`, `ready`, and `unavailable` engine states in the Mission Workbench.
- Generate workspace-local bridge scripts that can call extension-owned mission lookup, workflow lookup, task submission, and report submission entry points.
- Persist workflow runtime metadata and a concrete `go` or `no-go` probe verdict on the canonical mission record.
- Keep the Mission Workbench contract stable enough for later runtime slices to continue or swap transports without UI redesign.

**Non-Goals:**
- Running the full operation state machine or dispatching real multi-step workflows.
- Replacing the existing mission prompt send path for non-operation-backed missions.
- Building a production-hardened transport layer with remote access, multi-user auth, or background persistence beyond the active extension session.
- Implementing the fallback transport; this slice only records whether the extension-host bridge is viable.

## Decisions

### Store workflow probe metadata on the canonical mission runtime record

Each mission record will gain a `workflow` object that holds operation runtime metadata. For this slice the important fields are a mission-facing `runtimeStatus`, a `currentStep`, an `activeTask`, and a `probe` block that records the bridge verdict, summary, and last-checked timestamp.

- Chosen because the Mission Workbench and any later runtime controller both need the same source of truth, and the probe result must survive panel reopen flows.
- Alternative considered: keep probe state only in memory on the Workbench controller. Rejected because it disappears on reload and does not create the stable contract later slices need.
- Alternative considered: write a separate probe report file outside the mission record. Rejected because it splits mission workflow state across multiple files without improving the runtime contract.

### Use a workspace-scoped loopback HTTP bridge owned by the extension host

The extension host will start a lightweight loopback HTTP server on `127.0.0.1` for the active workspace and guard it with a generated bearer token. Mission-scoped runtime probes attach to that shared workspace bridge and expose endpoints for mission lookup, workflow lookup, task submission, and report submission.

- Chosen because it is reachable from local agent panes and generated scripts without depending on VS Code internals or the sibling repo, while staying simple enough for a probe slice.
- Alternative considered: named pipes. Rejected because they add more Windows-specific plumbing and make later cross-platform continuation harder without proving extra value for the probe.
- Alternative considered: file-drop polling. Rejected because it complicates readiness and acknowledgement semantics and gives a weaker signal about whether an extension-owned interactive bridge is viable.

### Materialize bridge scripts and manifest data into `.ff15/bridge`

The runtime probe will generate managed bridge assets under `.ff15/bridge`, including a manifest with the loopback URL and bearer token plus PowerShell-first scripts for mission lookup, workflow lookup, task submission, and report submission. The scripts are workspace-local so users can inspect them and agent panes can call them directly.

- Chosen because issue #22 explicitly requires workspace-local bridge scripts and the repo is Windows-first.
- Alternative considered: expose only raw HTTP details and make users author scripts themselves. Rejected because it fails the acceptance criteria and does not validate the bridge UX.
- Alternative considered: generate shell scripts only. Rejected because the validated target environment is Windows-first and the probe should optimize for that path first.

### Start the runtime probe from Mission Workbench readiness when a mission has an operation selected

When the Mission Workbench loads an operation-backed mission, the controller will ask the runtime probe service to ensure engine state for that mission. The service returns `starting` immediately, then updates to `ready` or `unavailable` after the bridge is initialized and self-checks complete.

- Chosen because the Mission Workbench is the user-facing surface that needs to communicate readiness, and issue #22 is explicitly about operation-backed missions.
- Alternative considered: bootstrap the probe on sidebar selection. Rejected because the sidebar is intentionally being kept thin and should not own runtime orchestration.
- Alternative considered: start probes eagerly for every mission on activation. Rejected because it wastes work and blurs the mission-scoped lifecycle.

### Record a concrete go or no-go verdict from the runtime self-check

After the runtime bridge starts and scripts are materialized, the probe will perform a self-check against the loopback endpoints and record either `go` or `no-go` with a short summary. The Mission Workbench surfaces that verdict so later issues can continue on the same contract or switch transport without redesigning the UI shape.

- Chosen because issue #22 is an architectural decision point, not just a hidden implementation detail.
- Alternative considered: rely on logs only. Rejected because later slices would have no stable, testable contract to inspect.
- Alternative considered: record readiness without an explicit verdict. Rejected because readiness alone does not tell later work whether this bridge is good enough to keep.

## Risks / Trade-offs

- [Loopback HTTP is local-process friendly but still a new attack surface] -> Bind to `127.0.0.1`, require a generated bearer token, and keep the initial endpoint set narrow.
- [Bridge scripts may drift from runtime endpoints] -> Generate scripts and manifest from the same runtime metadata source instead of duplicating endpoint details.
- [Workbench state could lag behind async probe transitions] -> Keep runtime metadata in the mission store and broadcast state updates whenever the probe status changes.
- [Probe verdicts can become stale after reload] -> Persist the last known verdict and re-run `ensure` on the next Workbench ready event for operation-backed missions.

## Migration Plan

No external migration is required. Existing mission records will hydrate with a null `workflow` block until an operation-backed mission is opened in the Mission Workbench.

## Open Questions

- None for this probe slice. If the recorded verdict is `no-go`, the follow-up work will define the fallback transport against the same Mission Workbench contract.