# multi-agent-ff15-vscode

`multi-agent-ff15-vscode` is a VS Code extension that lets an FF15-inspired party orchestrate work inside your workspace.

The current working roster is fixed to four agents:

- `Noctis` coordinates the mission.
- `Ignis` handles analysis and planning.
- `Gladiolus` focuses on robust implementation and hardening.
- `Prompto` is used for quick reconnaissance and first-pass work.

Inside VS Code, the extension adds an `FF15` activity bar container with three views:

- `Projects` for choosing the active project context and OpenSpec source.
- `Missions` for creating and reopening mission workbenches.
- `Settings` for launching the FF15 roster and opening VS Code settings for the extension.

The extension currently supports external FF15 roster launch on local Windows and in VS Code Remote - WSL.

## What You Can Do

Use this extension when you want to:

- keep a reusable mission history per workspace,
- launch an FF15 party into a target repository,
- choose an operation template before messaging Noctis,
- continue or steer individual agents from a mission workbench,
- switch between supported launch providers without changing your workspace flow.

## Requirements

Before using the extension, make sure the following tools are available on `PATH`:

- `zellij`
- `opencode` if you want to use the default provider
- `copilot` if you want to use GitHub Copilot CLI instead

Provider behavior:

- `opencode` launches panes with `opencode --agent <agent>`.
- `github-copilot-cli` launches panes with `copilot --agent <agent>`.

If you work in a multi-root workspace, FF15 uses the workspace folder of the active editor first. If there is no active editor, it falls back to the first workspace folder.

## Install And Build From Source

If you are using this repository directly, build the extension from source:

```bash
npm install
npm run compile
```

This produces a `.vsix` package that you can install in VS Code.

## Quick Start

1. Open the target repository as a workspace folder in VS Code.
2. Make sure `zellij` and your preferred launch client are installed.
	In Remote - WSL, these checks run against the Linux environment inside the active distro.
3. Open the `FF15` icon in the activity bar.
4. Open `Projects` and confirm the active project context.
5. Open `Settings` and click `Launch FF15` if you want to start the full party roster.
6. Open `Missions`, create a mission, and select it to open the Mission Workbench.
7. In the Mission Workbench, choose an operation, launch the mission terminal, and send your first prompt to Noctis.

## Recommended First Workflow

The intended day-to-day flow is:

1. Set up the workspace context in `Projects`.
2. Create or reopen a mission from `Missions`.
3. Pick an operation in the Mission Workbench.
4. Click `Launch Terminal`.
5. Draft the mission prompt and send it to Noctis.
6. Use the party roster to continue agents or adjust models when supported.
7. Reopen the same mission later and continue from the stored mission state.

## Using The Sidebar

### Projects

The `Projects` view is the workspace context summary.

Use it to:

- see which harness source is active,
- review `active_projects`,
- confirm how `OpenSpec` is currently resolved,
- notice warnings for incomplete project profiles,
- open the full `Projects Editor`.

Click `Open Projects Editor` to edit the live configuration.

### Projects Editor

The Projects Editor is the main place to configure FF15 for a workspace.

It lets you:

- choose one or more `active_projects`,
- switch `OpenSpec` mode between `project` and `harness`,
- choose the project that supplies the OpenSpec root when `project` mode is active,
- review the resolved config source path and warnings.

Changes are autosaved back to the harness config.

Configuration source:

FF15 reads harness configuration only from `.ff15/harness`. If it does not exist,
FF15 bootstraps a default harness there and shows a notification. Any legacy
`.agents/harness` directory is ignored.

### Missions

The `Missions` view is your navigator.

Use it to:

- create a new mission,
- reopen an existing mission workbench,
- see whether a mission is `Draft`, `Sending`, `Active`, or in `Delivery Error` state,
- identify whether the mission already has an attached Zellij session.

Selecting a mission opens the Mission Workbench.

### Settings

The `Settings` view gives you two actions:

- `Launch FF15` starts the fixed four-agent roster in Zellij.
- `Open FF15 Settings` opens the VS Code settings page filtered to this extension.

On local Windows, launching FF15 opens a separate terminal window and starts Zellij there.
In VS Code Remote - WSL, launching FF15 opens a host-side Windows terminal and runs `zellij` inside the active WSL distro using the current Linux workspace path.

## Working In The Mission Workbench

The Mission Workbench is where the main workflow happens.

### 1. Choose An Operation

Before you can send a mission prompt, select a supported operation from the catalog.

Bundled operations currently include:

- `github-issue-to-openspec-dev`
- `idea-to-openspec-dev`
- `idea-to-prd-and-issues`
- `shiritori-smoke-test`

The workbench shows both supported and unsupported entries. Unsupported entries stay visible with a reason.

### 2. Launch The Mission Terminal

Click `Launch Terminal` to attach or create the mission terminal session.

If a mission was previously launched, the button becomes `Reopen Terminal`.

You must launch the terminal before sending a prompt to Noctis.

### 3. Send A Prompt To Noctis

After selecting an operation and launching the terminal:

1. Write your mission prompt in the composer.
2. Click `Send to Noctis`.

If delivery fails, the mission moves into `Delivery Error` and the composer switches to `Retry Delivery`.

### 4. Continue The Party

The party roster shows the four active agents and their current pane availability.

From the roster, you can:

- inspect whether each agent is currently available,
- continue an individual agent,
- apply model changes when the selected provider supports model selection,
- apply bulk model presets to the party.

Provider capabilities are surfaced directly in the workbench. If an action is unavailable, the UI explains why.

### 5. Rename Or Reopen A Mission

Each mission keeps its own title, workspace root, workflow state, error state, and session name.

You can:

- rename the mission title,
- reopen the terminal later,
- delete the mission from the workbench,
- continue from persisted mission context after reloading VS Code.

## Launch Providers

The extension supports two providers:

### OpenCode

- Default provider.
- Selected through `multi-agent-ff15-vscode.launchClient = opencode`.
- FF15 validates that `opencode` is available before launch.

### GitHub Copilot CLI

- Selected through `multi-agent-ff15-vscode.launchClient = github-copilot-cli`.
- FF15 validates that `copilot` is available before launch.
- The extension uses agent-specific pane launches for the FF15 roster.

To change providers, open VS Code settings and update `FF15: Launch Client`.

## Workspace Files FF15 Creates

When the extension activates, it materializes workspace helper files so the mission flow can run with repository-local assets.

You will typically see FF15-managed files under:

- `.ff15/harness/` for harness config (bootstrapped with defaults when missing)
- `.ff15/operations/` for bundled operation definitions
- `.ff15/facets/` for bundled operation facets and prompt references
- `.ff15/missions/` for canonical mission runtime data and mission-scoped outputs
- `.ff15/bridge/` for runtime bridge assets used by operation-backed flows
- `.github/agents/` and `.opencode/agents/` for bundled agent templates copied into the workspace

Important behavior:

- `.ff15/harness` is the only configuration source; any `.agents/harness` is ignored.
- bundled operations are refreshed into `.ff15/operations/`, while unmanaged custom files are preserved,
- mission state persists per workspace so you can reopen the same mission later.

## Minimal Harness Example

If FF15 bootstraps a local harness, the default config is effectively shaped like this:

```yaml
version: 3

active_projects:
	- default

openspec:
	mode: project
	project_id: default
```

The default project profile is effectively shaped like this:

```yaml
id: default
openspec_root: .
repos:
	- id: extension
		root: .
summary: |
	Default local FF15 workspace profile.
```

Use the Projects Editor instead of manually editing these files unless you specifically want to manage them as text.

## Troubleshooting

### `Launch FF15` fails immediately

Check that:

- `zellij` is installed and available on `PATH`,
- the selected launch client is installed and available on `PATH`,
- the correct workspace folder is active in a multi-root workspace,
- in Remote - WSL, `WSL_DISTRO_NAME` is present and Windows-side WSL launching works from the current session.

### You cannot send a prompt to Noctis

Check that:

- a supported operation is selected,
- you clicked `Launch Terminal` first,
- the workspace folder is open,
- the mission is not stuck on a missing provider dependency.

### Projects shows warnings

Warnings usually mean one of these is incomplete in the selected harness profile:

- `openspec_root`
- repository `root`
- `default_checks`

The Projects sidebar and Projects Editor surface those warnings without blocking normal inspection.

## Current Scope

This extension currently focuses on:

- FF15 orchestration for local Windows and VS Code Remote - WSL launch flows,
- a fixed visible party of four agents,
- operation-backed mission delivery through Noctis,
- project context management inside VS Code,
- mission persistence and mission reopening.

If you are documenting or onboarding users, describe the extension as a mission-driven FF15 workspace companion for VS Code, not just a launcher.
