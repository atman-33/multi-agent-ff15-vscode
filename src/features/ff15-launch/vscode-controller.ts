import { type Uri, window, workspace } from "vscode";
import { createFf15LaunchController } from "./controller";
import { ensureCommandAvailable } from "./dependency-check";
import {
	createFf15LaunchClient,
	resolveFf15LaunchClientId,
} from "./launch-client";
import {
	prepareFf15LaunchLayout,
	resolveLaunchableCopilotCommand,
	resolveLaunchableOpencodeCommand,
} from "./layout";
import { launchZellijTerminal } from "./launch-terminal";
import { resolveActiveWorkspaceRoot } from "./workspace-root";
import { resolveFf15ProjectRuntimeContext } from "../ff15-projects/runtime-context";

export const createVsCodeFf15LaunchController = (extensionUri: Uri) => {
	const resolveRuntimeContext = () => {
		const workspaceRoot = resolveActiveWorkspaceRoot();
		if (!workspaceRoot) {
			return;
		}

		return resolveFf15ProjectRuntimeContext({ workspaceRoot });
	};

	const getLaunchClient = () =>
		createFf15LaunchClient(
			resolveFf15LaunchClientId(
				workspace
					.getConfiguration("multi-agent-ff15-vscode")
					.get("launchClient")
			),
			{
				ensureCommandAvailable,
				resolveCopilotCommand: resolveLaunchableCopilotCommand,
				resolveOpenCodeCommand: resolveLaunchableOpencodeCommand,
			}
		);

	return createFf15LaunchController({
		ensureCommandAvailable,
		getLaunchClient,
		getLaunchLayoutPath: (workspaceRoot, paneLaunchPlan) =>
			prepareFf15LaunchLayout({
				extensionRoot: extensionUri.fsPath,
				paneLaunchPlan,
				workspaceRoot,
			}),
		getWorkspaceRoot: () => resolveRuntimeContext()?.executionRoot,
		launchTerminal: launchZellijTerminal,
		showErrorMessage: window.showErrorMessage,
	});
};
