import { spawn } from "node:child_process";
import { env, window } from "vscode";
import type { LaunchTerminalInput } from "./types";

const SHELL_ARGUMENT_NEEDS_QUOTING_REGEX = /[\s'"]/;

export const MISSING_REMOTE_WSL_DISTRO_MESSAGE =
	"FF15 Remote WSL launch requires WSL_DISTRO_NAME in the remote environment.";
export const REMOTE_WSL_BRIDGE_FAILURE_MESSAGE =
	"FF15 Remote WSL launch failed to start a host terminal.";

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
}: {
	args?: string[];
	cwd?: string;
	executable: string;
}): string => {
	const escapedExecutable = escapePowerShellSingleQuotedString(executable);
	const argumentList =
		args.length === 0
			? ""
			: ` -ArgumentList @(${args
					.map((arg) => `'${escapePowerShellSingleQuotedString(arg)}'`)
					.join(", ")})`;
	const workingDirectory =
		cwd === undefined
			? ""
			: ` -WorkingDirectory '${escapePowerShellSingleQuotedString(cwd)}'`;

	return [
		"$ErrorActionPreference = 'Stop'",
		`Start-Process -FilePath '${escapedExecutable}'${argumentList}${workingDirectory}`,
	].join("; ");
};

export const buildRemoteWslLaunchArgs = ({
	args = [],
	cwd,
	executable,
}: LaunchTerminalInput): string[] => {
	const distroName = process.env.WSL_DISTRO_NAME;
	if (!distroName) {
		throw new Error(MISSING_REMOTE_WSL_DISTRO_MESSAGE);
	}

	return ["-d", distroName, "--cd", cwd, executable, ...args];
};

const toLaunchFailureError = (message: string, code?: number | null): Error =>
	new Error(
		code === undefined || code === null
			? message
			: `${message} (exit code: ${code})`
	);

const launchExternalTerminal = (
	{
		args,
		cwd,
		executable,
	}: Pick<LaunchTerminalInput, "args" | "cwd" | "executable">,
	failureMessage: string
): Promise<void> => {
	const script = buildWindowsStartProcessScript({
		args,
		cwd,
		executable,
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

		helper.once("error", () => reject(toLaunchFailureError(failureMessage)));
		helper.once("exit", (code) => {
			if (code === 0) {
				resolve();
				return;
			}

			reject(toLaunchFailureError(failureMessage, code));
		});
	});
};

const launchExternalWindowsTerminal = ({
	args,
	cwd,
	executable,
}: LaunchTerminalInput): Promise<void> =>
	launchExternalTerminal(
		{
			args,
			cwd,
			executable,
		},
		"Failed to launch external terminal"
	);

const launchRemoteWslTerminal = ({
	args,
	cwd,
	executable,
	name,
}: LaunchTerminalInput): Promise<void> => {
	try {
		return launchExternalTerminal(
			{
				args: buildRemoteWslLaunchArgs({
					args,
					cwd,
					executable,
					name,
				}),
				executable: "wsl.exe",
			},
			REMOTE_WSL_BRIDGE_FAILURE_MESSAGE
		);
	} catch (error) {
		return Promise.reject(error);
	}
};

const isRemoteWsl = (): boolean => env.remoteName === "wsl";

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

	if (isRemoteWsl()) {
		return launchRemoteWslTerminal({
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
