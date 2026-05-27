import type {
	Ff15LaunchClient,
	Ff15PaneLaunchPlanEntry,
} from "../ff15-launch/launch-client";
import type { LaunchTerminalInput } from "../ff15-launch/types";
import { deriveMissionSessionName } from "./controller";
import type {
	Ff15MissionAgentPanes,
	Ff15MissionsStore,
	Ff15MissionsStoreSnapshot,
} from "./state";

export const MISSING_MISSION_WORKSPACE_MESSAGE =
	"Open a workspace folder before opening a mission terminal.";
export const MISSING_MISSION_ZELLIJ_MESSAGE =
	"Mission terminals require `zellij` on PATH.";
export const MISSION_LAUNCH_FAILED_MESSAGE =
	"FF15 could not open the mission terminal.";
export const MISSION_DELETE_SESSION_FAILED_MESSAGE =
	"FF15 could not close the mission terminal session.";

const ZELLIJ_EXECUTABLE = "zellij";

interface Ff15MissionTerminalControllerDependencies {
	ensureCommandAvailable: (command: string) => Promise<void>;
	getLaunchClient: () => Ff15LaunchClient;
	getLaunchLayoutPath: (
		workspaceRoot: string,
		paneLaunchPlan: readonly Ff15PaneLaunchPlanEntry[]
	) => string;
	getWorkspaceRoot: () => string | undefined;
	launchTerminal: (input: LaunchTerminalInput) => Promise<void> | void;
	missionsStore: Ff15MissionsStore;
	reconcileMissionAgentPanes: (input: {
		agentPanes?: Ff15MissionAgentPanes;
		sessionName: string;
		workspaceRoot: string;
	}) => Promise<Ff15MissionAgentPanes>;
	showErrorMessage: (message: string) => PromiseLike<unknown> | void;
	terminateMissionSession: (input: {
		sessionName: string;
		workspaceRoot?: string;
	}) => Promise<void>;
}

const getErrorMessage = (error: unknown, fallback: string): string =>
	error instanceof Error && error.message.length > 0 ? error.message : fallback;

const buildMissionTerminalName = (missionTitle: string): string =>
	`FF15 ${missionTitle}`;

const buildMissionAttachArgs = (input: {
	layoutPath: string;
	sessionName: string;
}): string[] => [
	"attach",
	"--create",
	input.sessionName,
	"options",
	"--default-layout",
	input.layoutPath,
];

export const createFf15MissionSessionController = (
	dependencies: Ff15MissionTerminalControllerDependencies
) => {
	const openMissionSession = async (
		missionId: string
	): Promise<Ff15MissionsStoreSnapshot> => {
		const mission = dependencies.missionsStore.getMissionRecord(missionId);
		if (!mission) {
			return dependencies.missionsStore.getSnapshot();
		}

		const workspaceRoot =
			mission.workspaceRoot ?? dependencies.getWorkspaceRoot();
		if (!workspaceRoot) {
			await dependencies.showErrorMessage(MISSING_MISSION_WORKSPACE_MESSAGE);
			return dependencies.missionsStore.updateMission(missionId, {
				lastError: MISSING_MISSION_WORKSPACE_MESSAGE,
				status: "error",
			});
		}

		const sessionName =
			mission.sessionName ?? deriveMissionSessionName(workspaceRoot, missionId);

		try {
			await dependencies.ensureCommandAvailable(ZELLIJ_EXECUTABLE);
		} catch {
			await dependencies.showErrorMessage(MISSING_MISSION_ZELLIJ_MESSAGE);
			return dependencies.missionsStore.updateMission(missionId, {
				lastError: MISSING_MISSION_ZELLIJ_MESSAGE,
				sessionName,
				status: "error",
				workspaceRoot,
			});
		}

		const launchClient = dependencies.getLaunchClient();
		let paneLaunchPlan: readonly Ff15PaneLaunchPlanEntry[];

		try {
			await launchClient.ensureDependenciesAvailable();
			paneLaunchPlan = launchClient.getPaneLaunchPlan();
		} catch {
			const message = launchClient.getMissingDependencyMessage();
			await dependencies.showErrorMessage(message);
			return dependencies.missionsStore.updateMission(missionId, {
				lastError: message,
				sessionName,
				status: "error",
				workspaceRoot,
			});
		}

		try {
			const layoutPath = dependencies.getLaunchLayoutPath(
				workspaceRoot,
				paneLaunchPlan
			);
			await dependencies.launchTerminal({
				args: buildMissionAttachArgs({
					layoutPath,
					sessionName,
				}),
				cwd: workspaceRoot,
				executable: ZELLIJ_EXECUTABLE,
				name: buildMissionTerminalName(mission.title),
			});

			let agentPanes = mission.agentPanes;
			try {
				agentPanes = await dependencies.reconcileMissionAgentPanes({
					agentPanes: mission.agentPanes,
					sessionName,
					workspaceRoot,
				});
			} catch {
				agentPanes = mission.agentPanes;
			}

			return dependencies.missionsStore.updateMission(missionId, {
				agentPanes,
				lastError: null,
				sessionName,
				status: "active",
				workspaceRoot,
			});
		} catch (error) {
			const message = getErrorMessage(error, MISSION_LAUNCH_FAILED_MESSAGE);
			await dependencies.showErrorMessage(message);
			return dependencies.missionsStore.updateMission(missionId, {
				lastError: message,
				sessionName,
				status: "error",
				workspaceRoot,
			});
		}
	};

	return {
		createMission(): Promise<Ff15MissionsStoreSnapshot> {
			return dependencies.missionsStore.createMission();
		},
		async deleteMission(missionId: string): Promise<Ff15MissionsStoreSnapshot> {
			const mission = dependencies.missionsStore.getMissionRecord(missionId);
			if (!mission) {
				return dependencies.missionsStore.getSnapshot();
			}

			const workspaceRoot =
				mission.workspaceRoot ?? dependencies.getWorkspaceRoot();
			const sessionName =
				mission.sessionName ??
				(workspaceRoot
					? deriveMissionSessionName(workspaceRoot, missionId)
					: null);

			if (sessionName) {
				try {
					await dependencies.terminateMissionSession({
						sessionName,
						workspaceRoot,
					});
				} catch (error) {
					await dependencies.showErrorMessage(
						getErrorMessage(error, MISSION_DELETE_SESSION_FAILED_MESSAGE)
					);
				}
			}

			return dependencies.missionsStore.deleteMission(missionId);
		},
		openMissionSession,
		selectMission(missionId: string): Promise<Ff15MissionsStoreSnapshot> {
			return dependencies.missionsStore.selectMission(missionId);
		},
	};
};
