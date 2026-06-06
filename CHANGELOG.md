# 📦 Changelog

---

All notable changes to this project will be documented in this file.

---

## [Unreleased]

## [0.2.2] - 2026-06-07

### Added

- Added ff15-roster.kdl layout configuration file for defining agent rosters.
- Added development mode support with a UI badge indicator.

## [0.2.1] - 2026-06-06

### Added

- Added `create-release-tag.yml` workflow for manual release tag creation.

### Changed

- Updated extension display name for consistency.
- Renamed release workflow from `release-only.yml` to `create-release-tag.yml`.
- Updated release process documentation for manual tag creation.

## [0.2.0] - 2026-06-06

### Added

- Updated icon to new design.
- Added FF15 roster launch support in Remote - WSL.
- Added WSL error handling for mission terminal reopen.
- Unified bridge scripts to Python for cross-platform support (replaces PowerShell `.ps1` scripts with `.py` equivalents).
- Updated command line for cross-platform compatibility.

### Changed

- Updated package name and repository URL.
- Updated icon image for improved visual quality.

### Removed

- Removed workspace operation customization skill and validator.

## [0.1.0] - 2026-06-05

### Added

- Initial release of multi-agent-ff15-vscode.
- FF15 activity bar container with Projects, Missions, and Settings webview surfaces.
- `FF15: Open FF15 Settings` command.
- `multi-agent-ff15-vscode.launchClient` setting with `opencode` and `github-copilot-cli` options.
