## 1. Provider-aware workbench state

- [x] 1.1 Extend Mission Workbench controller state with provider-aware roster capability data and explicit unavailable reasons.
- [x] 1.2 Keep provider-specific model catalog projection and disabled-reason resolution in the extension-host controller/adapter path.

## 2. Party roster UI behavior

- [x] 2.1 Update the Mission Workbench route and party roster panel to render controls from provider capability plus runtime readiness.
- [x] 2.2 Surface explicit unavailable reasons in the roster UI when model or continue actions cannot run.

## 3. Validation

- [x] 3.1 Add focused tests for provider-aware workbench payload projection and roster UI gating behavior.
- [x] 3.2 Run focused mission tests, webview typecheck if needed, then root `npm run lint`, `npm run test`, and `npm run compile`.