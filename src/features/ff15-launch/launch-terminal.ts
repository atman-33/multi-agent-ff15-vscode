import { window } from "vscode";
import type { LaunchTerminalInput } from "./types";

export const launchZellijTerminal = ({
	command,
	cwd,
	name,
}: LaunchTerminalInput): void => {
	const terminal = window.createTerminal({
		cwd,
		name,
	});

	terminal.show();
	terminal.sendText(command, true);
};
