import { createHash } from "node:crypto";
import type {
	Ff15LaunchClient,
	Ff15PaneLaunchPlanEntry,
} from "../ff15-launch/launch-client";
import {
	buildOperationAwarePrompt,
	formatFf15OperationTaskLabel,
	loadMissionOperationActivation,
} from "../ff15-operations/definition";
import {
	createEmptyFf15MissionAgentPanes,
	createEmptyFf15MissionWorkflowState,
	type Ff15MissionAgentPanes,
	type Ff15MissionsStore,
} from "./state";

export const MISSING_WORKSPACE_MESSAGE =
	"Open a workspace folder before messaging Noctis.";
export const MISSING_ZELLIJ_MESSAGE =
	"Messaging Noctis requires `zellij` on PATH.";
export const MISSING_NOCTIS_PLAN_MESSAGE =
	"FF15 could not resolve a Noctis launch plan for the selected client.";
export const MISSION_SEND_FAILED_MESSAGE =
	"FF15 could not deliver the prompt to Noctis.";

interface Ff15MissionTransport {
	ensureMissionSession: (input: {
		allowCreateNoctisPane?: boolean;
		agentPanes?: Ff15MissionAgentPanes;
		missionId: string;
		paneLaunchPlanEntry: Ff15PaneLaunchPlanEntry;
		sessionName: string;
		workspaceRoot: string;
	}) => Promise<{ agentPanes?: Ff15MissionAgentPanes; paneId: string }>;
	sendPrompt: (input: {
		paneId: string;
		prompt: string;
		sessionName: string;
	}) => Promise<void>;
}

interface CreateFf15MissionSendControllerDependencies {
	ensureCommandAvailable: (command: string) => Promise<void>;
	getLaunchClient: () => Ff15LaunchClient;
	getWorkspaceRoot: () => string | undefined;
	missionTransport: Ff15MissionTransport;
	missionsStore: Ff15MissionsStore;
}

const getNoctisPaneLaunchPlanEntry = (
	launchClient: Ff15LaunchClient
): Ff15PaneLaunchPlanEntry | undefined =>
	launchClient
		.getPaneLaunchPlan()
		.find((paneLaunchPlanEntry) => paneLaunchPlanEntry.agentId === "noctis");

const getErrorMessage = (error: unknown, fallback: string): string =>
	error instanceof Error && error.message.length > 0 ? error.message : fallback;

const activateOperationWorkflow = (input: {
	operationRef: string;
	prompt: string;
	workflow: ReturnType<typeof createEmptyFf15MissionWorkflowState>;
	workspaceRoot: string;
}) => {
	const activation = loadMissionOperationActivation(
		input.workspaceRoot,
		input.operationRef
	);
	if (!activation) {
		return null;
	}

	const stepName = input.workflow.currentStep ?? activation.stepName;
	const activeTask =
		input.workflow.activeTask ??
		(stepName === activation.stepName
			? activation.activeTask
			: formatFf15OperationTaskLabel(stepName));

	return {
		prompt: buildOperationAwarePrompt({
			activation: {
				...activation,
				activeTask,
				stepName,
			},
			prompt: input.prompt,
		}),
		workflow: {
			...input.workflow,
			activeTask,
			currentStep: stepName,
			runtimeStatus: input.workflow.runtimeStatus ?? "ready",
		},
	};
};

const prepareMissionSend = async (
	dependencies: CreateFf15MissionSendControllerDependencies,
	input: { missionId: string; workspaceRoot: string | undefined },
	currentMission: ReturnType<Ff15MissionsStore["getMissionRecord"]>
): Promise<
	| {
			result: ReturnType<Ff15MissionsStore["getSnapshot"]>;
	  }
	| {
			paneLaunchPlanEntry: Ff15PaneLaunchPlanEntry;
			sessionName: string;
			workspaceRoot: string;
	  }
> => {
	const workspaceRoot = input.workspaceRoot;
	if (!workspaceRoot) {
		return {
			result: await dependencies.missionsStore.updateMission(input.missionId, {
				lastError: MISSING_WORKSPACE_MESSAGE,
				status: "error",
			}),
		};
	}

	const sessionName =
		currentMission?.sessionName ??
		deriveMissionSessionName(workspaceRoot, input.missionId);
	await dependencies.missionsStore.updateMission(input.missionId, {
		lastError: null,
		sessionName,
		status: "sending",
		workspaceRoot,
	});

	try {
		await dependencies.ensureCommandAvailable("zellij");
	} catch {
		return {
			result: await dependencies.missionsStore.updateMission(input.missionId, {
				lastError: MISSING_ZELLIJ_MESSAGE,
				status: "error",
				workspaceRoot,
			}),
		};
	}

	const launchClient = dependencies.getLaunchClient();

	try {
		await launchClient.ensureDependenciesAvailable();
	} catch {
		return {
			result: await dependencies.missionsStore.updateMission(input.missionId, {
				lastError: launchClient.getMissingDependencyMessage(),
				status: "error",
				workspaceRoot,
			}),
		};
	}

	const paneLaunchPlanEntry = getNoctisPaneLaunchPlanEntry(launchClient);
	if (!paneLaunchPlanEntry) {
		return {
			result: await dependencies.missionsStore.updateMission(input.missionId, {
				lastError: MISSING_NOCTIS_PLAN_MESSAGE,
				status: "error",
				workspaceRoot,
			}),
		};
	}

	return {
		paneLaunchPlanEntry,
		sessionName,
		workspaceRoot,
	};
};

export const deriveMissionSessionName = (
	workspaceRoot: string,
	missionId: string
): string => {
	const workspaceHash = createHash("sha256")
		.update(workspaceRoot)
		.digest("hex")
		.slice(0, 10);
	const normalizedMissionId = missionId
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, "-")
		.slice(0, 24)
		.replace(/^-+|-+$/g, "");

	return `ff15-${workspaceHash}-${normalizedMissionId || "mission"}`;
};

export const createFf15MissionSendController = (
	dependencies: CreateFf15MissionSendControllerDependencies
) => ({
	async submitPrompt(input: { missionId: string; prompt: string }) {
		const prompt = input.prompt.trim();
		if (prompt.length === 0) {
			return dependencies.missionsStore.getSnapshot();
		}

		const currentMission = dependencies.missionsStore.getMissionRecord(
			input.missionId
		);
		const currentWorkflow =
			currentMission?.workflow ?? createEmptyFf15MissionWorkflowState();
		let agentPanes =
			currentMission?.agentPanes ?? createEmptyFf15MissionAgentPanes();

		const preparedSend = await prepareMissionSend(
			dependencies,
			{
				missionId: input.missionId,
				workspaceRoot: dependencies.getWorkspaceRoot(),
			},
			currentMission
		);
		if ("result" in preparedSend) {
			return preparedSend.result;
		}

		const { paneLaunchPlanEntry, sessionName, workspaceRoot } = preparedSend;

		try {
			const { agentPanes: resolvedAgentPanes, paneId } =
				await dependencies.missionTransport.ensureMissionSession({
					allowCreateNoctisPane: currentMission?.sessionName == null,
					agentPanes,
					missionId: input.missionId,
					paneLaunchPlanEntry,
					sessionName,
					workspaceRoot,
				});
			agentPanes = resolvedAgentPanes ?? {
				...agentPanes,
				noctis: paneId,
			};

			const operationWorkflowActivation =
				currentMission?.operationRef && workspaceRoot
					? activateOperationWorkflow({
							operationRef: currentMission.operationRef,
							prompt,
							workflow: currentWorkflow,
							workspaceRoot,
						})
					: null;
			if (operationWorkflowActivation) {
				await dependencies.missionsStore.updateMission(input.missionId, {
					agentPanes,
					lastError: null,
					sessionName,
					status: "sending",
					workflow: operationWorkflowActivation.workflow,
					workspaceRoot,
				});
			}

			await dependencies.missionTransport.sendPrompt({
				paneId,
				prompt: operationWorkflowActivation?.prompt ?? prompt,
				sessionName,
			});

			return dependencies.missionsStore.updateMission(input.missionId, {
				agentPanes,
				lastError: null,
				sessionName,
				status: "active",
				workspaceRoot,
			});
		} catch (error) {
			return dependencies.missionsStore.updateMission(input.missionId, {
				agentPanes,
				lastError: getErrorMessage(error, MISSION_SEND_FAILED_MESSAGE),
				sessionName,
				status: "error",
				workspaceRoot,
			});
		}
	},
});
