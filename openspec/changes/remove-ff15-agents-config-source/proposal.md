## Why

The FF15 Projects context resolver currently looks for harness configuration in two
locations (`.agents/harness` first, then `.ff15/harness`). Supporting two roots adds
ambiguity about which configuration wins and complicates the mental model. We want a
single, predictable source of truth: `.ff15/harness`.

## What Changes

- **BREAKING**: Remove `.agents/harness` as a configuration source. Only `.ff15/harness`
  is read. Existing `.agents/harness` directories are ignored entirely (no migration,
  no warning).
- When `.ff15/harness` does not exist, the resolver continues to bootstrap default
  configuration files there (existing behavior, retained).
- Show an information notification when default configuration is created so the user
  understands why the files appeared.
- Drop the `"agents"` value from the `sourceKind` type across the extension and webview.
- Update README to describe `.ff15/harness` as the only config root.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `ff15-projects-context-resolver`: The configuration source resolution requirement
  changes from a two-root precedence (`.agents/harness` → `.ff15/harness`) to a single
  root (`.ff15/harness`), and a notification is emitted when defaults are bootstrapped.

## Impact

- `src/features/ff15-projects/context-resolver.ts` — resolution logic, `sourceKind` type,
  snapshot shape (`bootstrapped` flag).
- `src/features/ff15-projects/provider.ts` — emits the bootstrap notification.
- `webview-ui/src/app/routes/ff15-projects/model.ts` — `sourceKind` type and label formatting.
- Tests: `context-resolver.test.ts`, `runtime-context.test.ts`, `provider.test.ts`,
  `workbench-controller.test.ts`.
- `README.md` — documentation.
