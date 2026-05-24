import { type Uri, window } from "vscode";
import { createFf15LaunchController } from "./controller";
import { ensureCommandAvailable } from "./dependency-check";
import {
	prepareFf15LaunchLayout,
	resolveLaunchableOpencodeCommand,
} from "./layout";
import { launchZellijTerminal } from "./launch-terminal";
import { resolveActiveWorkspaceRoot } from "./workspace-root";

export const createVsCodeFf15LaunchController = (extensionUri: Uri) =>
	createFf15LaunchController({
		ensureCommandAvailable,
		getLaunchLayoutPath: (workspaceRoot) =>
			prepareFf15LaunchLayout({
				extensionRoot: extensionUri.fsPath,
				opencodeCommand: resolveLaunchableOpencodeCommand(),
				workspaceRoot,
			}),
		getWorkspaceRoot: resolveActiveWorkspaceRoot,
		launchTerminal: launchZellijTerminal,
		showErrorMessage: window.showErrorMessage,
	});
