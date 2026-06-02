import { spawn } from "node:child_process";
import { type Uri, window, workspace } from "vscode";
import { ensureCommandAvailable } from "../ff15-launch/dependency-check";
import {
	createFf15LaunchClient,
	resolveFf15LaunchClientId,
	type Ff15LaunchClientId,
} from "../ff15-launch/launch-client";
import {
	prepareFf15LaunchLayout,
	resolveLaunchableCopilotCommand,
	resolveLaunchableOpencodeCommand,
} from "../ff15-launch/layout";
import { launchZellijTerminal } from "../ff15-launch/launch-terminal";
import { resolveActiveWorkspaceRoot } from "../ff15-launch/workspace-root";
import { resolveFf15ProjectRuntimeContext } from "../ff15-projects/runtime-context";
import { createFf15MissionSendController } from "./controller";
import { createFf15MissionSessionController } from "./session-controller";
import type { Ff15MissionRecord, Ff15MissionsStore } from "./state";
import { createFf15MissionZellijTransport } from "./transport";

type Ff15MissionTransport = ReturnType<typeof createFf15MissionZellijTransport>;

const MISSING_ZELLIJ_SESSION_ERROR_PATTERN = /\bnot found\b/i;

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

const isMissingZellijSessionError = (error: unknown): boolean => {
	if (!(error instanceof Error)) {
		return false;
	}

	return MISSING_ZELLIJ_SESSION_ERROR_PATTERN.test(error.message);
};

export const terminateZellijMissionSession = (input: {
	runCommand?: typeof runZellijCommand;
	sessionName: string;
	workspaceRoot?: string;
}): Promise<void> => {
	const runCommand = input.runCommand ?? runZellijCommand;

	return runCommand({
		args: ["delete-session", "--force", input.sessionName],
		cwd: input.workspaceRoot,
	}).catch((error) => {
		if (isMissingZellijSessionError(error)) {
			return;
		}

		throw error;
	});
};

const getConfiguredLaunchClientId = (): Ff15LaunchClientId =>
	resolveFf15LaunchClientId(
		workspace.getConfiguration("multi-agent-ff15-vscode").get("launchClient")
	);

const createGetLaunchClient = () => (mission: Ff15MissionRecord) =>
	createFf15LaunchClient(mission.providerId, {
		ensureCommandAvailable,
		resolveCopilotCommand: resolveLaunchableCopilotCommand,
		resolveOpenCodeCommand: resolveLaunchableOpencodeCommand,
	});

const resolveRuntimeContext = () => {
	const workspaceRoot = resolveActiveWorkspaceRoot();
	if (!workspaceRoot) {
		return;
	}

	return resolveFf15ProjectRuntimeContext({ workspaceRoot });
};

export const createVsCodeFf15MissionSendController = (
	missionsStore: Ff15MissionsStore,
	missionTransport: Ff15MissionTransport = createFf15MissionZellijTransport(),
	isMissionTerminalReady?: (missionId: string) => boolean
) => {
	const getLaunchClient = createGetLaunchClient();

	return createFf15MissionSendController({
		ensureCommandAvailable,
		getLaunchClient,
		getWorkspaceRoot: () => resolveRuntimeContext()?.executionRoot,
		isMissionTerminalReady,
		missionTransport,
		missionsStore,
		resolveRuntimeContext: ({ workspaceRoot }) =>
			resolveFf15ProjectRuntimeContext({ workspaceRoot }),
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
		getPinnedProviderId: getConfiguredLaunchClientId,
		getLaunchClient,
		getLaunchLayoutPath: (workspaceRoot, paneLaunchPlan) =>
			prepareFf15LaunchLayout({
				extensionRoot: extensionUri.fsPath,
				paneLaunchPlan,
				workspaceRoot,
			}),
		getWorkspaceRoot: () => resolveRuntimeContext()?.executionRoot,
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
			terminateZellijMissionSession({
				sessionName,
				workspaceRoot,
			}),
	});
};
