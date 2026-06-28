## 1. Update resolver core

- [x] 1.1 Change the FF15 Projects config root from `join(workspaceRoot, ".ff15", "harness")` to `join(workspaceRoot, ".ff15")` in `context-resolver.ts`.
- [x] 1.2 Switch the "config exists" detection from the root directory to `.ff15/config/config.yaml`.
- [x] 1.3 Update the harness owner root calculation from `dirname(dirname(harnessRoot))` to `dirname(ff15Root)`.
- [x] 1.4 Update bootstrap paths so defaults are written under `.ff15/config` and `.ff15/projects`.

## 2. Update user-facing surfaces

- [x] 2.1 Update the bootstrap notification in `provider.ts` to reference `.ff15` instead of `.ff15/harness`.
- [x] 2.2 Update the `formatSourceKind` label in `webview-ui/src/app/routes/ff15-projects/model.ts` to `.ff15`.

## 3. Update tests

- [x] 3.1 Update `context-resolver.test.ts` fixture paths and expectations from `.ff15/harness` to `.ff15`.
- [x] 3.2 Update `provider.test.ts` snapshot `sourcePath` values from `.ff15/harness` to `.ff15`.
- [x] 3.3 Update `runtime-context.test.ts` snapshot `sourcePath` values from `.ff15/harness` to `.ff15`.
- [x] 3.4 Update `workbench-controller.test.ts` snapshot `sourcePath` value from `.ff15/harness` to `.ff15`.

## 4. Update documentation

- [x] 4.1 Update `README.md` references to `.ff15/harness` to describe `.ff15` as the config root.

## 5. Validate

- [x] 5.1 Run `npm run compile` and fix any TypeScript errors.
- [x] 5.2 Run `npm run test` and fix failing tests.
- [x] 5.3 Run `npm run lint` and fix any style issues.
