## Context

`launch-terminal.ts` currently decides between a Windows-only external launch path and an integrated terminal fallback. Issue #71 adds a third environment: Remote - WSL. In that mode, the extension still runs in a remote workspace, but the terminal window must be opened on the Windows host and execute `zellij` inside the active distro using the existing Linux workspace root and generated layout path.

## Goals / Non-Goals

**Goals:**
- Detect Remote - WSL through VS Code environment state without changing the controller contract more than necessary.
- Reuse the existing Windows-side bridge pattern to open an external terminal for Remote - WSL.
- Distinguish WSL bridge launch failures from missing `zellij` or launch-client dependency failures.
- Preserve current local Windows and non-WSL fallback behavior.

**Non-Goals:**
- General mixed Windows and WSL launching outside VS Code Remote - WSL.
- Mission terminal reopen behavior covered by the follow-up issue.
- Additional Windows Terminal specific integration such as `wt.exe` customization.

## Decisions

- Detect the Remote - WSL environment inside `launch-terminal.ts` using `vscode.env.remoteName === "wsl"`.
  Alternative considered: passing environment flags from the controller. Rejected because launch-environment detection is local to terminal creation and would widen the controller surface unnecessarily.
- Build a dedicated Remote - WSL launch command that runs `wsl.exe -d <WSL_DISTRO_NAME> --cd <workspaceRoot> zellij --layout <layoutPath>` through the existing host-side PowerShell launch bridge.
  Alternative considered: translating workspace paths back to Windows paths or invoking integrated terminals. Rejected because the approved behavior requires Linux-side execution in the active distro and external host terminal launch.
- Represent Remote - WSL bridge failures with a dedicated error type or explicit error message that the launch controller can surface directly to the user.
  Alternative considered: allowing raw spawn errors to bubble up. Rejected because acceptance criteria require a distinct user-visible launch outcome.

## Risks / Trade-offs

- Missing `WSL_DISTRO_NAME` in a Remote - WSL window could block launch entirely -> fail fast with a distinct launch error so the user can diagnose the environment mismatch.
- The Windows-side bridge may fail even when Linux-side dependencies are present -> keep preflight checks Linux-focused and report bridge failure only at launch time.
- Test coverage relies on mocking VS Code and child-process behavior -> keep tests focused on externally observable command construction and surfaced launch results.