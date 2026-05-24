import { spawn } from "node:child_process";
import { window } from "vscode";
import type { LaunchTerminalInput } from "./types";

const SHELL_ARGUMENT_NEEDS_QUOTING_REGEX = /[\s'"]/;

const escapePowerShellSingleQuotedString = (value: string): string =>
	value.replaceAll("'", "''");

const quoteShellArgument = (value: string): string => {
	if (value.length === 0) {
		return "''";
	}

	if (!SHELL_ARGUMENT_NEEDS_QUOTING_REGEX.test(value)) {
		return value;
	}

	return `'${value.replaceAll("'", "'\\''")}'`;
};

export const buildTerminalCommand = ({
	executable,
	args = [],
}: Pick<LaunchTerminalInput, "args" | "executable">): string =>
	[executable, ...args.map(quoteShellArgument)].join(" ");

export const buildWindowsStartProcessScript = ({
	args = [],
	cwd,
	executable,
}: LaunchTerminalInput): string => {
	const escapedExecutable = escapePowerShellSingleQuotedString(executable);
	const escapedCwd = escapePowerShellSingleQuotedString(cwd);
	const argumentList =
		args.length === 0
			? ""
			: ` -ArgumentList @(${args
					.map((arg) => `'${escapePowerShellSingleQuotedString(arg)}'`)
					.join(", ")})`;

	return [
		"$ErrorActionPreference = 'Stop'",
		`Start-Process -FilePath '${escapedExecutable}'${argumentList} -WorkingDirectory '${escapedCwd}'`,
	].join("; ");
};

const launchExternalWindowsTerminal = ({
	args,
	cwd,
	executable,
	name,
}: LaunchTerminalInput): Promise<void> => {
	const script = buildWindowsStartProcessScript({
		args,
		cwd,
		executable,
		name,
	});

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
	args,
	cwd,
	executable,
	name,
}: LaunchTerminalInput): Promise<void> | void => {
	if (process.platform === "win32") {
		return launchExternalWindowsTerminal({
			args,
			cwd,
			executable,
			name,
		});
	}

	const terminal = window.createTerminal({
		cwd,
		name,
	});

	terminal.show();
	terminal.sendText(
		buildTerminalCommand({
			args,
			executable,
		}),
		true
	);
};
