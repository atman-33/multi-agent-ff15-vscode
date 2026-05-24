import { spawn } from "node:child_process";
import { window } from "vscode";
import type { LaunchTerminalInput } from "./types";

const escapePowerShellSingleQuotedString = (value: string): string =>
	value.replaceAll("'", "''");

const launchExternalWindowsTerminal = ({
	command,
	cwd,
}: LaunchTerminalInput): Promise<void> => {
	const escapedCommand = escapePowerShellSingleQuotedString(command);
	const escapedCwd = escapePowerShellSingleQuotedString(cwd);
	const script = [
		"$ErrorActionPreference = 'Stop'",
		`Start-Process -FilePath '${escapedCommand}' -WorkingDirectory '${escapedCwd}'`,
	].join("; ");

	return new Promise((resolve, reject) => {
		const helper = spawn(
			"powershell.exe",
			["-NoProfile", "-NonInteractive", "-Command", script],
			{
				cwd,
				stdio: "ignore",
				windowsHide: true,
			}
		);

		helper.once("error", reject);
		helper.once("exit", (code) => {
			if (code === 0) {
				resolve();
				return;
			}

			reject(new Error(`Failed to launch external terminal: ${code}`));
		});
	});
};

export const launchZellijTerminal = ({
	command,
	cwd,
	name,
}: LaunchTerminalInput): Promise<void> | void => {
	if (process.platform === "win32") {
		return launchExternalWindowsTerminal({
			command,
			cwd,
			name,
		});
	}

	const terminal = window.createTerminal({
		cwd,
		name,
	});

	terminal.show();
	terminal.sendText(command, true);
};
