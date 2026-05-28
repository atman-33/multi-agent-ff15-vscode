## 1. Bundled agent resources

- [x] 1.1 Move the FF15 GitHub Copilot and OpenCode agent definitions into `src/resources/workspace-template/.github/agents` and `src/resources/workspace-template/.opencode/agents` as the only authoritative source and remove the duplicate repository-root agent folders
- [x] 1.2 Ensure the packaged extension still includes the mirrored workspace-template resource tree needed for workspace materialization

## 2. Workspace materialization

- [x] 2.1 Add a focused helper that copies the bundled FF15 agent files into `.github/agents` and `.opencode/agents` for a resolved workspace root, overwriting the managed files each time
- [x] 2.2 Call the workspace agent materialization helper from extension activation, skipping the write when no workspace root is available

## 3. Verification

- [x] 3.1 Add focused tests for helper-level agent file materialization, including overwrite behavior
- [x] 3.2 Add or update activation tests to cover activation with and without a workspace root
- [x] 3.3 Run the focused tests plus repository compile validation for this slice