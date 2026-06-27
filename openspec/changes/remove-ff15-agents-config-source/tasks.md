## 1. Core resolver

- [x] 1.1 Narrow `Ff15ProjectsContextSourceKind` to `"ff15"` in `context-resolver.ts`
- [x] 1.2 Add `bootstrapped: boolean` to the harness source type and `Ff15ProjectsContextSnapshot`
- [x] 1.3 Rewrite `resolveHarnessSource` to read only `.ff15/harness`, bootstrapping when absent, and report `bootstrapped`
- [x] 1.4 Propagate `bootstrapped` through `loadHarnessSnapshot` and `buildErrorSnapshot`

## 2. Notification

- [x] 2.1 Import `window` (value) in `provider.ts`
- [x] 2.2 Show an information message once when `snapshot.bootstrapped` is true, guarded against repeats

## 3. Webview

- [x] 3.1 Remove `"agents"` from the `sourceKind` union in `webview-ui/src/app/routes/ff15-projects/model.ts`
- [x] 3.2 Remove the `"agents"` branch from `formatSourceKind`

## 4. Tests

- [x] 4.1 Update `context-resolver.test.ts`: replace `.agents` precedence/error tests with `.ff15`-only behavior; repoint helper writes to `.ff15/harness`
- [x] 4.2 Add test that bootstrap sets `bootstrapped: true` and existing config sets it false
- [x] 4.3 Update `runtime-context.test.ts`, `provider.test.ts`, `workbench-controller.test.ts` to use `"ff15"` / `.ff15/harness`
- [x] 4.4 Add provider test that notification shows on bootstrap and not otherwise

## 5. Docs & verification

- [x] 5.1 Update `README.md` to describe `.ff15/harness` as the only config root with auto-bootstrap
- [x] 5.2 Run `npm test` and `npm run build`; confirm both pass (4 pre-existing unrelated failures in ff15-missions/opencode-chat remain)
