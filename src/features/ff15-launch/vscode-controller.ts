import { window } from "vscode";
import { createFf15LaunchController } from "./controller";
import { ensureCommandAvailable } from "./dependency-check";
import { launchZellijTerminal } from "./launch-terminal";
import { resolveActiveWorkspaceRoot } from "./workspace-root";

export const createVsCodeFf15LaunchController = () =>
	createFf15LaunchController({
		ensureCommandAvailable,
		getWorkspaceRoot: resolveActiveWorkspaceRoot,
		launchTerminal: launchZellijTerminal,
		showErrorMessage: window.showErrorMessage,
	});
