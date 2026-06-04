## Context

Issues #59 through #62 moved provider-aware mission behavior behind a few narrow boundaries: mission state persists provider-owned fields, provider adapters own workflow delivery, `agent-actions.ts` routes roster actions through provider-aware rules, and the Mission Workbench posts explicit provider capability state. The remaining risk is not missing implementation surface but missing regression coverage across those boundaries, especially where GitHub Copilot and OpenCode differ.

## Goals / Non-Goals

**Goals:**
- Cover each provider-aware boundary with focused tests that exercise public behavior rather than implementation details.
- Preserve GitHub Copilot behavior while validating OpenCode parity for the same action surfaces.
- Reuse existing focused test files instead of introducing a new cross-cutting integration harness.

**Non-Goals:**
- Changing mission runtime behavior or provider adapter contracts.
- Adding new providers, new Mission Workbench features, or new operation workflow capabilities.
- Reworking existing tests that are unrelated to provider-aware mission behavior.

## Decisions

- Extend the existing focused mission and runtime test files instead of creating a new integration suite.
  Rationale: the provider-aware redesign already exposes narrow public interfaces in each touched module, so targeted regression tests keep failures local and readable.
- Validate provider parity as small matrix-style assertions in the owning test file for each boundary.
  Rationale: GitHub Copilot preservation and OpenCode parity matter at the same call surface, and side-by-side cases make unsupported drift obvious.
- Keep validation aligned to behavior slices: state/adapter resolution, roster actions, workbench capability projection, and operation workflow delivery.
  Rationale: this mirrors the implementation boundaries introduced by issues #59 to #62 and avoids duplicating the same expectations in multiple files.

## Risks / Trade-offs

- [Coverage overlap] -> Some provider-aware expectations can fit more than one test file. Mitigation: place each assertion at the narrowest owning surface and avoid cross-file duplication.
- [Implementation-coupled tests] -> Validation work can drift into white-box assertions. Mitigation: assert observable payloads, resolved provider choices, and dispatched inputs instead of private helper steps.
- [Stacked branch dependency] -> Issue #63 is validated on top of issue #61 and #62 work. Mitigation: keep the slice test-only and scoped to the current stacked branch surfaces.