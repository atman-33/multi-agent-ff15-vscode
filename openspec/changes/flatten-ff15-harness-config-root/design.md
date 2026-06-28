## Context

The FF15 Projects context resolver in `src/features/ff15-projects/context-resolver.ts` treats `.ff15/harness` as the configuration root. All harness configuration lives two levels below the workspace root: `.ff15/harness/config/agent-harness.yaml` and `.ff15/harness/projects/*.yaml`. Other FF15 runtime data (missions, operations, bridge) already lives directly under `.ff15`, so the extra `harness` directory is inconsistent and unnecessary.

## Goals / Non-Goals

**Goals:**
- Move the Projects configuration root from `.ff15/harness` to `.ff15`.
- Keep `config/` and `projects/` as subdirectories directly under `.ff15`.
- Ensure bootstrap still works when `.ff15` already exists for other FF15 features.
- Update all code, tests, UI labels, and documentation that reference `.ff15/harness`.

**Non-Goals:**
- No migration or backward compatibility for existing `.ff15/harness` directories.
- No changes to the `agent-harness.yaml` schema or project profile schema.
- No changes to other `.ff15` runtime directories (`missions`, `operations`, `bridge`, `facets`).

## Decisions

1. **Config root becomes `join(workspaceRoot, ".ff15")`.**
   - Rationale: `.ff15` is already the workspace-local FF15 runtime root; config should live alongside the other runtime directories.

2. **Existence detection uses `config/agent-harness.yaml` instead of the root directory.**
   - Rationale: `.ff15` may already exist because operations, missions, or bridge materialized their files there. Checking the directory would skip bootstrap and leave the resolver without config.

3. **Harness owner root becomes `dirname(ff15Root)`.**
   - Rationale: With the root at `.ff15`, the owner workspace is simply the parent of `.ff15`. The previous `dirname(dirname(harnessRoot))` assumed two levels of nesting.

4. **Keep source kind `"ff15"` and internal `harnessRoot` naming.**
   - Rationale: This is a path change, not a conceptual change. Renaming all symbols would touch many files without improving clarity enough to justify the churn. The public `sourcePath` will simply report the `.ff15` path.

5. **Ignore any existing `.ff15/harness` directory.**
   - Rationale: The project is still in active development and the user explicitly opted out of migration or fallback behavior.

## Risks / Trade-offs

- **[Existing `.ff15/harness` users lose config]** → Accepted. Users must move `config/` and `projects/` up one level into `.ff15/` manually.
- **[`.ff15` already exists triggers no bootstrap if config file is missing]** → Mitigated by checking the config file directly; bootstrap still creates the file and any missing parent directories.
- **[UI label `.ff15` is less specific than `.ff15/harness`** → Mitigated by also showing the full `sourcePath` in the UI.
