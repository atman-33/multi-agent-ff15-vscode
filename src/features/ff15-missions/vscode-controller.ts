import { spawn } from "node:child_process";
import { type Uri, window, workspace } from "vscode";
import { ensureCommandAvailable } from "../ff15-launch/dependency-check";
import {
	createFf15LaunchClient,
	resolveFf15LaunchClientId,
} from "../ff15-launch/launch-client";
import {
	prepareFf15LaunchLayout,
	resolveLaunchableCopilotCommand,
	resolveLaunchableOpencodeCommand,
} from "../ff15-launch/layout";
import { launchZellijTerminal } from "../ff15-launch/launch-terminal";
import { resolveActiveWorkspaceRoot } from "../ff15-launch/workspace-root";
import { createFf15MissionSendController } from "./controller";
import { createFf15MissionSessionController } from "./session-controller";
import type { Ff15MissionsStore } from "./state";
import { createFf15MissionZellijTransport } from "./transport";

type Ff15MissionTransport = ReturnType<typeof createFf15MissionZellijTransport>;

const runZellijCommand = (input: {
	args: string[];
	cwd?: string;
}): Promise<void> =>
	new Promise((resolve, reject) => {
		const command = spawn("zellij", input.args, {
			cwd: input.cwd,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stderr = "";

		command.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		command.once("error", reject);
		command.once("exit", (code) => {
			if (code === 0) {
				resolve();
				return;
			}

			reject(
				new Error(
					stderr.trim() ||
						`zellij ${input.args.join(" ")} failed with exit code ${code}`
				)
			);
		});
	});

const createGetLaunchClient = () => () =>
	createFf15LaunchClient(
		resolveFf15LaunchClientId(
			workspace.getConfiguration("multi-agent-ff15-vscode").get("launchClient")
		),
		{
			ensureCommandAvailable,
			resolveCopilotCommand: resolveLaunchableCopilotCommand,
			resolveOpenCodeCommand: resolveLaunchableOpencodeCommand,
		}
	);

export const createVsCodeFf15MissionSendController = (
	missionsStore: Ff15MissionsStore,
	missionTransport: Ff15MissionTransport = createFf15MissionZellijTransport()
) => {
	const getLaunchClient = createGetLaunchClient();

	return createFf15MissionSendController({
		ensureCommandAvailable,
		getLaunchClient,
		getWorkspaceRoot: resolveActiveWorkspaceRoot,
		missionTransport,
		missionsStore,
	});
};

export const createVsCodeFf15MissionSessionController = (
	extensionUri: Uri,
	missionsStore: Ff15MissionsStore,
	missionTransport: Ff15MissionTransport = createFf15MissionZellijTransport()
) => {
	const getLaunchClient = createGetLaunchClient();

	return createFf15MissionSessionController({
		ensureCommandAvailable,
		getLaunchClient,
		getLaunchLayoutPath: (workspaceRoot, paneLaunchPlan) =>
			prepareFf15LaunchLayout({
				extensionRoot: extensionUri.fsPath,
				paneLaunchPlan,
				workspaceRoot,
			}),
		getWorkspaceRoot: resolveActiveWorkspaceRoot,
		launchTerminal: launchZellijTerminal,
		missionsStore,
		reconcileMissionAgentPanes: ({ agentPanes, sessionName, workspaceRoot }) =>
			missionTransport.reconcileMissionAgentPanes({
				agentPanes,
				sessionName,
				workspaceRoot,
			}),
		showErrorMessage: window.showErrorMessage,
		terminateMissionSession: ({ sessionName, workspaceRoot }) =>
			runZellijCommand({
				args: ["kill-session", sessionName],
				cwd: workspaceRoot,
			}),
	});
};
