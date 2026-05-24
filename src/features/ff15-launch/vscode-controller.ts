import { type Uri, window } from "vscode";
import { createFf15LaunchController } from "./controller";
import { ensureCommandAvailable } from "./dependency-check";
import { resolveBundledFf15LayoutPath } from "./layout";
import { launchZellijTerminal } from "./launch-terminal";
import { resolveActiveWorkspaceRoot } from "./workspace-root";

export const createVsCodeFf15LaunchController = (extensionUri: Uri) =>
	createFf15LaunchController({
		ensureCommandAvailable,
		getBundledLayoutPath: () =>
			resolveBundledFf15LayoutPath(extensionUri.fsPath),
		getWorkspaceRoot: resolveActiveWorkspaceRoot,
		launchTerminal: launchZellijTerminal,
		showErrorMessage: window.showErrorMessage,
	});
