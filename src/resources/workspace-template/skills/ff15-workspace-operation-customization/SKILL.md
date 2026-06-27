---
name: ff15-workspace-operation-customization
description: Create or diagnose workspace-local FF15 operation files and related facets under .ff15/operations and .ff15/facets. Use when adding or editing custom workspace operations, debugging why a workspace operation is not discoverable or routable, or validating workspace-local YAML and facet references for the VS Code extension.
argument-hint: Describe the workspace-local operation or facet files to create or change, whether the task includes diagnostics, and whether to run the bundled validator.
---

# Workspace Operation Customization

Create or revise workspace-local FF15 operations for the VS Code extension without assuming the bundled builtin catalog will discover them automatically.

## When To Use

- Add or edit `.ff15/operations/*.yaml`
- Add or edit workspace-local `.ff15/facets/**` files referenced by a custom operation
- Diagnose workspace-local routing, placeholder, or path-resolution failures
- Validate custom operation YAML after every edit

## Workflow

1. Confirm the workspace root and the target operation path under `.ff15/operations/`.
2. Inspect the closest existing workspace-local operation and any referenced `.ff15/facets/**` files before drafting.
3. Keep every `file:` reference relative to the operation YAML file.
4. Keep each step to `name`, `agent`, `instruction`, `output_contracts`, and `rules`; prefer a file-backed `instruction` once an inline instruction becomes non-trivial, and reference reusable project skills inline with `{{ facet_skill("name") }}` instead of separate `job`/`skills`/`policies` fields.
5. Run the bundled validator on every created or modified operation YAML:
   - `python .claude/skills/ff15-workspace-operation-customization/scripts/validate-operation-yaml.py .ff15/operations/<file>.yaml`
   - If your environment exposes `python3` instead of `python`, use that equivalent command.
   - You may pass multiple files or the whole `.ff15/operations` directory.
6. Treat validator failures as blocking.
7. If the operation still does not show up or load, check whether the current extension build actually catalogs arbitrary workspace-authored operations before assuming the YAML is wrong.
8. Summarize changed files, validator results, and any remaining runtime limitation.

## Diagnostics

- Check `initial_step` ownership and terminal transitions first.
- Check `instruction.file` and `output_contracts.report[].format.file` relative to the YAML file.
- Check `{{ output(...) }}`, `{{ setting(...) }}`, `{{ root(...) }}`, and `{{ facet_skill(...) }}` placeholders for supported syntax and declared outputs. `{{ facet_skill("name") }}` resolves to the absolute path of the project facet skill at `.ff15/facets/skills/<name>/SKILL.md`.
- Check multiline `inline: |` blocks for accidental nesting of sibling fields.
- If the operation is expected to appear in a picker, verify whether the active extension build catalogs workspace-authored operations or only bundled ones.

## Guardrails

- Do not assume same-name workspace and bundled operations collapse into one entry.
- Do not skip the validator for small edits.
- Keep the fewest steps that satisfy ownership and artifact boundaries.
- Treat missing Python or PyYAML (`yaml`) support as a setup blocker for validator use.
- Treat unsupported legacy fields and unresolved file references as blocking.

## Completion Criteria

- The validator passes for every touched workspace operation YAML.
- Every referenced workspace-local facet file exists.
- `initial_step` points to a Noctis step that does not route directly to `ABORT` or `COMPLETE`.
- Placeholder and output-contract references are consistent.
- Any remaining runtime limitation is called out explicitly.
