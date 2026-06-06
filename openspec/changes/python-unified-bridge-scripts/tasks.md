## 1. Bridge Script Generation

- [ ] 1.1 Replace `createPowerShellScript` with `createPythonScript` in `src/features/ff15-operations/runtime-probe.ts`
- [ ] 1.2 Update `writeBridgeAssets` to write `.py` files instead of `.ps1`
- [ ] 1.3 Ensure each `.py` script reads `bridge-manifest.json` from its own directory and calls the engine with `urllib.request`

## 2. Prompt Path Updates

- [ ] 2.1 Update `buildStepCompletionContract` in `src/features/ff15-operations/definition.ts` to reference `.py` bridge script paths
- [ ] 2.2 Update any callers or tests that assert prompt content containing `.ps1`

## 3. Tests

- [ ] 3.1 Update `src/features/ff15-operations/runtime-probe.test.ts` to assert `.py` file existence and content
- [ ] 3.2 Update `src/features/ff15-operations/definition.test.ts` prompt assertions
- [ ] 3.3 Update `src/features/ff15-missions/controller.test.ts` prompt assertions
- [ ] 3.4 Run all affected tests and fix failures until green
