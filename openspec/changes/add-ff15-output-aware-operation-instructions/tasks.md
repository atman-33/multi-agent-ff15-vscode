## 1. Placeholder resolution context

- [x] 1.1 Identify the first real bundled workflow assets that still contain unresolved output-aware placeholders and codify the expected resolved prompt behavior in focused tests
- [x] 1.2 Extend prompt composition inputs with the mission/runtime context needed to resolve prior outputs, workspace-root placeholders, runtime asset paths, and relevant FF15 settings

## 2. Output-aware prompt assembly

- [x] 2.1 Resolve authored placeholders inside shared operation prompt composition before XML delivery for Noctis and worker-owned steps
- [x] 2.2 Fail prompt delivery with actionable runtime errors when referenced outputs, contracts, settings, or assets cannot be resolved

## 3. Verification

- [x] 3.1 Add focused tests for successful placeholder resolution and missing-reference failures using bundled workflow assets beyond smoke-test prompts
- [x] 3.2 Run repository validation commands: `npm run lint`, `npm run test`, and `npm run compile`