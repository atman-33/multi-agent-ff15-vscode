## 1. Session Controller WSL Error Propagation Tests

- [x] 1.1 Add test: mission session controller surfaces `MISSING_REMOTE_WSL_DISTRO_MESSAGE` as mission error when `launchTerminal` throws it
- [x] 1.2 Add test: mission session controller surfaces `REMOTE_WSL_BRIDGE_FAILURE_MESSAGE` as mission error when `launchTerminal` throws it
- [x] 1.3 Add test: mission session controller surfaces a generic error as `MISSION_LAUNCH_FAILED_MESSAGE` fallback when `launchTerminal` throws a non-Error value

## 2. Validation

- [x] 2.1 Run existing session-controller tests to verify no regression (186 tests, 28 files, all passing)
- [x] 2.2 Run `npm run compile` to verify no type errors (build + package successful)
