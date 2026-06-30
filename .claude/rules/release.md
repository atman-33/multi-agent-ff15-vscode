---
paths:
  - package.json
  - CHANGELOG.md
  - .github/workflows/release.yml
  - .github/workflows/version-bump.yml
  - .github/workflows/create-release-tag.yml
---
# Release Process (Summary)

Full reference: docs/release-process.md

## Standard release (version bump + publish)
1. Merge all feature PRs to `main`.
2. GitHub Actions → "Version Bump" workflow → `release_type: minor` (or `major`/`patch`).
   - Auto-bumps `package.json`, updates `CHANGELOG.md`, pushes release branch + PR, tags `vX.Y.Z`.
3. Tag push triggers `release.yml` automatically → build → `.vsix` → publish to VS Code Marketplace + Open VSX.
4. Verify GitHub Release page and marketplace listing.
5. Merge the auto-created release PR (so `main` reflects the bump).

## Release without bump (tag only)
Use when `package.json` already has the target version:
- GitHub Actions → "Create Release Tag" → input `version: X.Y.Z`.

## CHANGELOG policy
- Do NOT manually pre-write version sections. The Version Bump workflow handles it via `taj54/universal-version-bump`.
- Commits must follow Conventional Commits (`feat:`, `fix:`, `chore:`, etc.) to appear in the changelog.

## Re-run / republish
Re-run or manually dispatch `release.yml` with `version` input. Publishing is idempotent (`skipDuplicate: true`).

## Required secrets (GitHub repo settings)
- `VSCE_PAT` — VS Code Marketplace PAT
- `OPEN_VSX_TOKEN` — Open VSX token
