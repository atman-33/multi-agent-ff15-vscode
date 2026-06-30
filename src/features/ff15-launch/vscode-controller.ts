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

const UNINITIALIZED_WORKSPACE_MESSAGE =
	"FF15 workspace is not initialized. Open the Projects view and run Initialize.";

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

	const controller = createFf15LaunchController({
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

	return {
		async launch(): Promise<LaunchResult> {
			// Gate launch on an initialized `.ff15`; otherwise the harness has no
			// config/profiles to drive the party and would fail opaquely.
			const runtimeContext = resolveRuntimeContext();
			if (
				runtimeContext &&
				runtimeContext.projectsSnapshot.status !== "ready"
			) {
				await window.showErrorMessage(UNINITIALIZED_WORKSPACE_MESSAGE);
				return {
					cwd: runtimeContext.executionRoot,
					message: UNINITIALIZED_WORKSPACE_MESSAGE,
					status: "error",
				};
			}

			return controller.launch();
		},
	};
};
