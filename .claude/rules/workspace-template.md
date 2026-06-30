---
paths:
  - "src/resources/workspace-template/**"
  - "src/resources/facets/**"
  - "src/resources/operations/**"
---
# Workspace Template / Resource Rules

- Files under `src/resources/workspace-template/` are scaffolded verbatim into user workspaces — keep them self-contained and do not reference internal extension paths.
- Biome linting is **disabled** for these directories; do not run `npm run check` or `npm run fix` targeting them specifically.
- YAML files under `src/resources/facets/` and `src/resources/operations/` serve as default templates; user-local overrides live in the workspace `.ff15/` directory (not in this repo).
