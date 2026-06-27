---
name: ff15-workspace-operation-customization
description: Create or diagnose workspace-local FF15 operation files and related facets under .ff15/operations and .ff15/facets. Use when adding or editing custom workspace operations, debugging why a workspace operation is not discoverable or routable, or validating workspace-local YAML and facet references for the VS Code extension.
argument-hint: Describe the workspace-local operation or facet files to create or change, whether the task includes diagnostics, and whether to run the bundled validator.
---

# Workspace Operation Customization

Create or revise workspace-authored FF15 operations for the VS Code extension. The extension's bundled catalog (`catalog.ts:39-68` `FF15_BUNDLED_OPERATION_DEFINITIONS`) only loads four builtin operations and never indexes arbitrary workspace-authored YAML under `.ff15/operations/`. A workspace-authored file can still pass the validator and be executed as a mission by referencing it directly via the operation loader — but it will not appear in any builtin picker.

## When To Use

- Add or edit `.ff15/operations/*.yaml`
- Add or edit workspace-local `.ff15/facets/**` files referenced by a workspace-authored operation
- Diagnose workspace-local routing, placeholder, or path-resolution failures
- Validate workspace-authored operation YAML after every edit

## Workflow

1. Confirm the workspace root and the target operation path under `.ff15/operations/`.
2. Inspect the closest existing workspace-authored operation and any referenced `.ff15/facets/**` files before drafting. If no workspace-authored example exists, study the four bundled samples materialized under `.ff15/operations/` — `idea-to-prd-and-issues.yaml` (noctis-only) and `shiritori-smoke-test.yaml`, `github-issue-to-openspec-dev.yaml`, `idea-to-openspec-dev.yaml` (four-agent).
3. Keep every `file:` reference relative to the operation YAML file.
4. Keep each step to `name`, `agent`, `instruction`, `output_contracts`, and `rules`; prefer a file-backed `instruction` once an inline instruction becomes non-trivial, and reference reusable project skills inline with `{{ facet_skill("name") }}`.
5. Run the bundled validator on every created or modified operation YAML:
   - `node .claude/skills/ff15-workspace-operation-customization/scripts/validate-operation-yaml.mjs .ff15/operations/<file>.yaml`
   - The same `node` command works on Windows and WSL. The script prefers the `yaml` npm package when resolvable and otherwise falls back to a built-in minimal parser scoped to the operation schema, so it needs no extra install in the materialized workspace.
   - You may pass multiple files or the whole `.ff15/operations` directory.
6. Treat validator failures as blocking. The runtime operation loader (`definition.ts` `parseOperationDefinition` / `readOperationStep`) is lenient: unknown step fields, missing `rules`, non-noctis `initial_step`, and unresolved `instruction.file` are silently skipped or nulled rather than raised. The validator is the only authority that catches these — do not skip it for small edits.
7. If the file still does not show up in a picker, confirm whether the active extension build catalogs arbitrary workspace-authored operations. As of the current build it does not; surface this as an explicit runtime limitation rather than treating the YAML as wrong.
8. Summarize changed files, validator results, and any remaining runtime limitation.

## Diagnostics

- Check `initial_step` ownership and terminal transitions first.
- Check `instruction.file` and `output_contracts.report[].format.file` relative to the YAML file.
- Check `{{ output(...) }}`, `{{ setting(...) }}`, `{{ root(...) }}`, and `{{ facet_skill(...) }}` placeholders for supported syntax and declared outputs. `{{ facet_skill("name") }}` resolves to the absolute path of the project facet skill at `.ff15/facets/skills/<name>/SKILL.md`.
- Check multiline `inline: |` blocks for accidental nesting of sibling fields.

## Guardrails

- Workspace-authored operations are never merged or shadowed into the bundled catalog: the loader resolves `builtin:*` refs only against `FF15_BUNDLED_OPERATION_DEFINITIONS` and ignores unrelated files under `.ff15/operations/`.
- Keep the fewest steps that satisfy ownership and artifact boundaries.
- Treat missing `node` as a setup blocker for validator use. The `yaml` npm package is optional; the validator falls back to a built-in minimal parser when it cannot be resolved.
- Treat unsupported legacy fields and unresolved file references as blocking.

## Completion Criteria

- The validator passes for every touched workspace operation YAML.
- Every referenced workspace-local facet file exists.
- `initial_step` points to a Noctis step that does not route directly to `ABORT` or `COMPLETE`.
- Placeholder and output-contract references are consistent.
- Any remaining runtime limitation is called out explicitly.