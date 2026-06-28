---
name: ff15-workspace-project-setup
description: Register or edit workspace-local FF15 project profiles under .ff15/projects and activate them in .ff15/config/config.yaml. Use when adding or editing a project profile, registering a project in active_projects, diagnosing why a registered project is not resolved for OpenSpec, or validating project profile YAML for the VS Code extension.
argument-hint: Describe the project profile to create or change, its repositories and openspec_root, whether to activate it in config, and whether to run the bundled validator.
---

# Workspace Project Setup

Register or revise workspace-local FF15 project profiles for the VS Code extension. Each project profile lives at `.ff15/projects/<id>.yaml` and is activated through `.ff15/config/config.yaml`. The loader reads only `<id>.yaml` files; entries starting with `_` (such as `_template.yaml`) are templates and are ignored.

## When To Use

- Add or edit `.ff15/projects/<id>.yaml`
- Activate a project by adding its `id` to `active_projects` in `.ff15/config/config.yaml`
- Diagnose why a registered project is not resolved for OpenSpec
- Validate project profile YAML after every edit

## Profile Schema

A project profile is a YAML mapping with these fields:

- `id` (required): unique project identifier. **Must equal the file name stem**, so a profile with `id: app` lives at `.ff15/projects/app.yaml`.
- `openspec_root` (required): path to the project's OpenSpec directory, **relative to the workspace root** (the parent of `.ff15`). The resolved path must exist.
- `repos` (required, non-empty): list of repository mappings. Each entry has:
  - `id`: repository identifier.
  - `root`: repository root path, relative to the workspace root. The resolved path must exist.
  - `default_checks` (recommended): list of check commands for the repo.
- `summary` (optional): short human-readable description.

Config activation in `.ff15/config/config.yaml`:

- `active_projects`: list of project ids to include in the session. Every listed id must have a matching `.ff15/projects/<id>.yaml`.
- `openspec.project_id` (optional): which active project supplies OpenSpec resolution. If set, it must be listed in `active_projects` and have a profile file.
- `language`: `en` or `ja`.

## Workflow

1. Confirm the workspace root and the target profile path under `.ff15/projects/`. Pick an `id` and name the file `<id>.yaml`.
2. Start from `.ff15/projects/_template.yaml` and fill in `id`, `openspec_root`, `repos`, and `summary`.
3. Write `openspec_root` and every repo `root` as paths relative to the workspace root, and verify each resolves to an existing directory.
4. Activate the project: add `id` to `active_projects` in `.ff15/config/config.yaml`, and set `openspec.project_id` if this project should drive OpenSpec resolution.
5. Run the bundled validator on every created or modified profile, and on `.ff15` to check config consistency:
   - `node .claude/skills/ff15-workspace-project-setup/scripts/validate-project-yaml.mjs .ff15/projects/<id>.yaml`
   - You may pass multiple files, the whole `.ff15/projects` directory, or `.ff15` (which also checks `config.yaml` consistency).
   - The same `node` command works on Windows and WSL.
6. Treat validator failures as blocking.
7. Summarize changed files, validator results, and any remaining warnings.

## Diagnostics

- If a project is not resolved for OpenSpec, check that its `id` is present in `active_projects` and that `openspec.project_id` (when set) names an active project with an existing profile.
- Check that the file name stem matches the `id` field; a mismatch makes the loader skip or misresolve the profile.
- Check that `openspec_root` and each repo `root` resolve relative to the workspace root, not relative to `.ff15`.
- Remember that `_`-prefixed files are templates and never loaded as active profiles.

## Guardrails

- Do not let the file name diverge from the `id` field.
- Do not resolve `openspec_root` or repo `root` relative to `.ff15`; they are relative to the workspace root.
- Do not skip the validator for small edits.
- Keep top-level fields limited to `id`, `openspec_root`, `repos`, and `summary`.

## Completion Criteria

- The validator passes for every touched profile YAML and reports no config-consistency errors.
- Every profile file name stem equals its `id` field.
- `openspec_root` and every repo `root` resolve to existing directories.
- Every id in `active_projects` has a matching profile, and `openspec.project_id` (if set) names an active project with an existing profile.
- Any remaining warning (such as a missing `default_checks`) is called out explicitly.
