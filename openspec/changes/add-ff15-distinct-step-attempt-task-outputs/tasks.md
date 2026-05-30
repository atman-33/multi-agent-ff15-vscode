## 1. Task-id allocation

- [x] 1.1 Replace fixed `task-<step>` generation with workflow-aware attempt allocation (`task-<step>`, `task-<step>-2`, ...)
- [x] 1.2 Apply the allocator to output-contract path rendering and step-completion contract task ids

## 2. Runtime transition consistency

- [x] 2.1 Use the same allocator for report validation so expected task ids match the currently dispatched attempt
- [x] 2.2 Use the same allocator for follow-up dispatch metadata and prompts

## 3. Verification

- [x] 3.1 Add focused tests for repeated step attempts in operation definition prompt composition
- [x] 3.2 Add focused runtime probe tests for incremented task ids and latest-artifact dispatch
- [x] 3.3 Run repository validation with `npm run lint`, `npm run test`, and `npm run compile`