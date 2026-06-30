# multi-agent-ff15-vscode

VS Code extension that drives an FF15-inspired AI agent party (Noctis, Ignis, Gladiolus, Prompto) from inside the editor. The extension hosts a React/Tailwind webview UI and communicates with agents via Zellij + OpenCode.

# Commands

- install: `npm run install:all` (installs both extension deps and `webview-ui/` deps)
- build: `npm run build` (extension via esbuild + webview via Vite)
- dev: `npm run watch` (concurrent tsc watch + webview Vite dev)
- test: `npm test`
- lint/check: `npm run check` (Biome via ultracite)
- fix: `npm run fix`
- package: `npm run package` → produces `.vsix`

# Code Style

Formatter: Biome (ultracite). Enforced style non-defaults:
- Indentation: **tabs** (not spaces)
- Quotes: **double**
- Semicolons: **always**
- Types: use `interface` (not `type` alias) for object shapes

# Structure

- `src/` — extension host (TypeScript, Node/VS Code API)
- `src/features/` — one subdirectory per feature (ff15-missions, ff15-projects, ff15-operations, opencode-chat, …)
- `src/resources/workspace-template/` — scaffolded into user workspaces; **not linted by Biome**
- `webview-ui/` — React 18 + Tailwind v4 + Vite; builds separately
- `webview-ui/src/app/components/ui/` — shadcn/ui generated components; **do not edit manually**

<important>
Runtime requirements (must be on PATH inside WSL): `zellij`, `opencode` (or `copilot` for the GitHub Copilot CLI provider). The extension checks for these at launch.
After editing `src/resources/workspace-template/` files, do NOT run `npm run check` — Biome excludes that directory by design.
</important>
