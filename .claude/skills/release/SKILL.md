---
name: release
description: >
  Runs the full GitHub Actions release pipeline for this extension: triggers
  version-bump, creates the PR (GITHUB_TOKEN workaround), waits for merge, then
  dispatches the release workflow. Use when the user wants to release, publish,
  ship a version, bump the version, or says "バージョンアップ", "リリース",
  "release minor/major/patch".
argument-hint: "Release type: minor, major, or patch (default: minor)"
compatibility: "requires: gh (authenticated), repo atman-33/multi-agent-ff15-vscode"
---

# Release — multi-agent-ff15-vscode

Full GitHub Actions release. One unavoidable manual step: merging the PR.

## Quick start

1. Confirm bump type.
2. Trigger version-bump workflow → wait → create PR if Actions could not.
3. Ask user to merge the PR.
4. Dispatch `release.yml`.
5. Report Actions URL.

## Workflow

### 1. Gather inputs

- **Bump type**: from argument or ask once (`minor` / `major` / `patch`).
- Read current version from the repo root:
  ```bash
  node -p "require('./package.json').version"
  ```
- Compute next version (semver). Confirm with user if not supplied as argument.

Repo: `atman-33/multi-agent-ff15-vscode`

Completion: bump type and next version confirmed.

### 2. Trigger version-bump workflow

```bash
gh workflow run version-bump.yml \
  --repo atman-33/multi-agent-ff15-vscode \
  --field release_type=<TYPE>
```

Wait ~20 s, then verify the branch appeared:
```bash
gh api repos/atman-33/multi-agent-ff15-vscode/branches/version-bump/v<VERSION> \
  2>/dev/null && echo "EXISTS"
```

**Known limitation**: The workflow logs a PR-creation error — this is expected.
`GITHUB_TOKEN` cannot create PRs when the "Allow GitHub Actions to create pull
requests" repo setting is disabled. The branch and bump commit are pushed correctly.

Completion: branch `version-bump/v<VERSION>` exists on remote.

### 3. Create PR (if workflow did not)

Check first:
```bash
gh pr list --repo atman-33/multi-agent-ff15-vscode \
  --head version-bump/v<VERSION> --json number,url
```

If empty, create:
```bash
gh pr create \
  --repo atman-33/multi-agent-ff15-vscode \
  --base main \
  --head version-bump/v<VERSION> \
  --title "chore(release): bump version to v<VERSION>" \
  --body "Automated version bump: <PREV> → <VERSION>."
```

Completion: PR URL reported to user.

### 4. Wait for PR merge

Tell the user the PR URL and say:
> "PR をレビューしてマージしてください。マージが完了したら教えてください。"

Wait for user confirmation before proceeding.

Completion: user confirms the PR is merged.

### 5. Dispatch release workflow

**Known limitation**: Tags pushed by `GITHUB_TOKEN` do not trigger other workflow
runs. Always dispatch `release.yml` manually after merge — do not rely on the tag
push to auto-trigger it.

```bash
gh workflow run release.yml \
  --repo atman-33/multi-agent-ff15-vscode \
  --field version=<VERSION>
```

Fetch and report the run URL:
```bash
gh run list --repo atman-33/multi-agent-ff15-vscode \
  --workflow=release.yml --limit 1 --json url
```

Completion: release workflow is running; URL reported.

### 6. Report

- Version bumped: `<PREV>` → `<VERSION>`
- Release workflow URL (monitor for build + publish)
- Expected outcomes: GitHub Release created, published to VS Code Marketplace + Open VSX
- Next: verify marketplace listings after ~5–10 minutes

## Failure modes

| Symptom | Action |
|---------|--------|
| version-bump fails entirely (not just the PR step) | Check Actions log; `gh run rerun <run-id>` |
| Branch `version-bump/v<VERSION>` missing after 30 s | Re-run version-bump workflow |
| `release.yml` fails | Dispatch again — publishing is idempotent (`skipDuplicate: true`) |
| Tag already exists | Skip steps 2–4; go directly to step 5 (dispatch `release.yml`) |
