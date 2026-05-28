## Context

The extension already ships bundled runtime assets under `src/resources` and materializes some of them into the target workspace, notably builtin operations under `.ff15/operations`. FF15 launch clients, however, expect agent definition files to exist directly in the workspace under `.github/agents` for GitHub Copilot CLI and `.opencode/agents` for OpenCode, and the extension currently does not provision those files.

This slice needs to make agent provisioning reliable without adding a large management subsystem. The user explicitly wants a single source of truth, one execution timing, and automatic overwrite when the extension package updates its bundled agent files.

## Goals / Non-Goals

**Goals:**

- Keep `src/resources/workspace-template` as the only authoritative source for bundled FF15 workspace files, starting with the FF15 agent definitions.
- Materialize the six GitHub Copilot and six OpenCode agent files into the active workspace during extension activation.
- Overwrite the managed workspace files on each activation so bundled agent updates are propagated automatically.
- Keep the implementation narrow and testable through focused helper and activation tests.

**Non-Goals:**

- Expanding the FF15 launch roster beyond the current launch-client behavior in this slice.
- Adding checksums, manifests, or selective merge logic for user-edited generated files.
- Deleting unrelated user-owned files that happen to live under `.github/agents` or `.opencode/agents`.

## Decisions

### Use a mirrored workspace-template tree as the single source of truth

The extension will store managed workspace files under `src/resources/workspace-template`, preserving the same relative paths that will exist in the target workspace. For this slice, that means `src/resources/workspace-template/.github/agents/*` and `src/resources/workspace-template/.opencode/agents/*`, and the repository-root `.github/agents` and `.opencode/agents` directories will no longer be treated as authoritative sources. This aligns the assets with the packaging rule that already preserves `src/resources/**` inside the VSIX and keeps future `.github/skills` or `.opencode/skills` additions on the same path-mirroring contract.

Alternative considered: keep client- and kind-specific resource folders such as `src/resources/agents/github`. Rejected because it introduces path-mapping logic for each resource category and makes future workspace-managed files harder to extend.

### Materialize agent files during extension activation

`activate()` will resolve the active workspace root and, when one exists, call a dedicated helper that creates the target directories and copies the bundled agent files into place. Activation is the only execution point, which satisfies the user's simplicity requirement and ensures extension updates refresh the managed files before the next FF15 action.

Alternative considered: materialize only before launch or mission terminal open. Rejected because that delays prompt refresh until a narrower workflow entry point and adds branching at multiple call sites.

### Overwrite known managed files without manifest-driven cleanup

The helper will always overwrite the known FF15 managed files from the mirrored workspace-template tree, but it will not attempt to remove unknown files from the destination folders. This keeps the implementation small while still satisfying the requirement that bundled prompt updates automatically replace prior generated versions.

Alternative considered: add a managed manifest and delete stale files. Rejected for now because it adds tracking complexity that is not required by the requested behavior.

## Risks / Trade-offs

- [Activation writes into the workspace immediately] -> Limit the behavior to the known FF15 agent file set and skip materialization when no workspace root is available.
- [User edits to managed generated files are overwritten on next activation] -> Treat generated agent files as extension-managed deployment artifacts and keep the single source of truth in `src/resources/workspace-template`.
- [Workspace windows with multiple folders may materialize only one root] -> Reuse the existing active-workspace-root resolution logic so behavior matches the rest of the extension.