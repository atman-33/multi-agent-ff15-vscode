## Context

`resolveHarnessSource` in `src/features/ff15-projects/context-resolver.ts` resolves the
harness configuration root with a two-step precedence: `.agents/harness` then
`.ff15/harness`, bootstrapping `.ff15/harness` only when neither exists. The
`sourceKind` value (`"agents" | "ff15"`) flows through the snapshot type, the provider,
the workbench controller, and the webview label formatter. Bootstrapping of defaults is
already implemented via `bootstrapFf15Harness` + `ensureTextFile`.

## Goals / Non-Goals

**Goals:**
- Make `.ff15/harness` the single configuration root.
- Keep the existing default-file bootstrap behavior when `.ff15/harness` is absent.
- Notify the user (information message) when defaults are created.
- Remove the `"agents"` `sourceKind` from code, webview, and tests.

**Non-Goals:**
- Migrating or warning about existing `.agents/harness` directories (explicitly ignored).
- Changing the default config file contents or schema version.
- Recreating individual missing files inside an existing `.ff15/harness` directory.

## Decisions

- **Single-root resolution**: `resolveHarnessSource` checks only `.ff15/harness`. If it
  exists, use it; otherwise bootstrap it and use it. The `.agents/harness` branch is
  deleted. Chosen over keeping a deprecated alias to avoid lingering ambiguity.
- **Bootstrap notification via snapshot flag**: `context-resolver.ts` stays free of the
  `vscode` runtime dependency. The harness source and `Ff15ProjectsContextSnapshot` gain
  a `bootstrapped: boolean` field set true only when bootstrap ran this resolution. The
  provider (which already imports from `vscode`) shows `window.showInformationMessage`
  once when `snapshot.bootstrapped` is true, guarded by an instance flag to avoid repeats.
  Chosen over emitting the message from the resolver to keep the resolver pure and unit-testable.
- **Type narrowing**: `Ff15ProjectsContextSourceKind` becomes `"ff15"` only. The webview
  `sourceKind` union and `formatSourceKind` drop the `"agents"` case.

## Risks / Trade-offs

- [Existing `.agents/harness` users silently lose their config source] → Accepted per
  decision; documented in README. They can move config into `.ff15/harness`.
- [Notification could be noisy if resolution runs multiple times] → Mitigated by the
  per-instance guard so the message shows at most once per session.
