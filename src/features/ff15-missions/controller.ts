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
export const MISSING_OPERATION_SELECTION_MESSAGE =
	"Select an operation before sending a mission prompt.";
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
	resolveRuntimeContext?: (input: { workspaceRoot: string }) => {
		activeProjects: string[];
		executionRoot: string;
		openspecRoot: string | null;
	};
}

const getNoctisPaneLaunchPlanEntry = (
	launchClient: Ff15LaunchClient
): Ff15PaneLaunchPlanEntry | undefined =>
	launchClient
		.getPaneLaunchPlan()
		.find((paneLaunchPlanEntry) => paneLaunchPlanEntry.agentId === "noctis");

const getErrorMessage = (error: unknown, fallback: string): string =>
	error instanceof Error && error.message.length > 0 ? error.message : fallback;

const shouldReuseOperationWorkflowStep = (
	stepName: string | null
): stepName is string =>
	typeof stepName === "string" &&
	stepName.length > 0 &&
	!stepName.startsWith("probe:");

const activateOperationWorkflow = (input: {
	activeProjects?: string[];
	missionId: string;
	operationRef: string;
	openspecRoot?: string | null;
	prompt: string;
	workflow: ReturnType<typeof createEmptyFf15MissionWorkflowState>;
	workspaceRoot: string;
}) => {
	const reusableWorkflowStep = shouldReuseOperationWorkflowStep(
		input.workflow.currentStep
	)
		? input.workflow.currentStep
		: null;
	const activation = loadMissionOperationActivation(
		input.workspaceRoot,
		input.operationRef,
		reusableWorkflowStep ?? undefined
	);
	if (!activation) {
		return null;
	}

	const stepName = activation.stepName;
	let activeTask =
		stepName === activation.stepName
			? activation.activeTask
			: formatFf15OperationTaskLabel(stepName);
	if (reusableWorkflowStep && input.workflow.activeTask) {
		activeTask = input.workflow.activeTask;
	}

	return {
		prompt: buildOperationAwarePrompt({
			activation: {
				...activation,
				activeTask,
			},
			activeProjects: input.activeProjects,
			missionId: input.missionId,
			openspecRoot: input.openspecRoot,
			prompt: input.prompt,
			workflow: input.workflow,
			workspaceRoot: input.workspaceRoot,
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
			runtimeContext: {
				activeProjects: string[];
				executionRoot: string;
				openspecRoot: string | null;
			};
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

	const runtimeContext = dependencies.resolveRuntimeContext?.({
		workspaceRoot,
	}) ?? {
		activeProjects: [],
		executionRoot: workspaceRoot,
		openspecRoot: null,
	};

	const sessionName =
		currentMission?.sessionName ??
		deriveMissionSessionName(runtimeContext.executionRoot, input.missionId);
	await dependencies.missionsStore.updateMission(input.missionId, {
		lastError: null,
		sessionName,
		status: "sending",
		workspaceRoot: runtimeContext.executionRoot,
	});

	try {
		await dependencies.ensureCommandAvailable("zellij");
	} catch {
		return {
			result: await dependencies.missionsStore.updateMission(input.missionId, {
				lastError: MISSING_ZELLIJ_MESSAGE,
				status: "error",
				workspaceRoot: runtimeContext.executionRoot,
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
				workspaceRoot: runtimeContext.executionRoot,
			}),
		};
	}

	const paneLaunchPlanEntry = getNoctisPaneLaunchPlanEntry(launchClient);
	if (!paneLaunchPlanEntry) {
		return {
			result: await dependencies.missionsStore.updateMission(input.missionId, {
				lastError: MISSING_NOCTIS_PLAN_MESSAGE,
				status: "error",
				workspaceRoot: runtimeContext.executionRoot,
			}),
		};
	}

	return {
		paneLaunchPlanEntry,
		runtimeContext,
		sessionName,
		workspaceRoot: runtimeContext.executionRoot,
	};
};

const requireOperationSelection = (input: {
	mission: ReturnType<Ff15MissionsStore["getMissionRecord"]>;
	missionId: string;
	missionsStore: Ff15MissionsStore;
}) => {
	if (input.mission?.operationRef) {
		return null;
	}

	return input.missionsStore.updateMission(input.missionId, {
		lastError: MISSING_OPERATION_SELECTION_MESSAGE,
	});
};

const deliverMissionPrompt = async (input: {
	currentMission: ReturnType<Ff15MissionsStore["getMissionRecord"]>;
	currentWorkflow: ReturnType<typeof createEmptyFf15MissionWorkflowState>;
	dependencies: CreateFf15MissionSendControllerDependencies;
	missionId: string;
	paneLaunchPlanEntry: Ff15PaneLaunchPlanEntry;
	prompt: string;
	runtimeContext: {
		activeProjects: string[];
		executionRoot: string;
		openspecRoot: string | null;
	};
	sessionName: string;
	workspaceRoot: string;
}) => {
	let agentPanes =
		input.currentMission?.agentPanes ?? createEmptyFf15MissionAgentPanes();

	try {
		const { agentPanes: resolvedAgentPanes, paneId } =
			await input.dependencies.missionTransport.ensureMissionSession({
				allowCreateNoctisPane: input.currentMission?.sessionName == null,
				agentPanes,
				missionId: input.missionId,
				paneLaunchPlanEntry: input.paneLaunchPlanEntry,
				sessionName: input.sessionName,
				workspaceRoot: input.workspaceRoot,
			});
		agentPanes = resolvedAgentPanes ?? {
			...agentPanes,
			noctis: paneId,
		};

		const operationWorkflowActivation = input.currentMission?.operationRef
			? activateOperationWorkflow({
					activeProjects: input.runtimeContext.activeProjects,
					missionId: input.missionId,
					openspecRoot: input.runtimeContext.openspecRoot,
					operationRef: input.currentMission.operationRef,
					prompt: input.prompt,
					workflow: input.currentWorkflow,
					workspaceRoot: input.workspaceRoot,
				})
			: null;
		if (operationWorkflowActivation) {
			await input.dependencies.missionsStore.updateMission(input.missionId, {
				agentPanes,
				lastError: null,
				sessionName: input.sessionName,
				status: "sending",
				workflow: operationWorkflowActivation.workflow,
				workspaceRoot: input.workspaceRoot,
			});
		}

		await input.dependencies.missionTransport.sendPrompt({
			paneId,
			prompt: operationWorkflowActivation?.prompt ?? input.prompt,
			sessionName: input.sessionName,
		});

		return input.dependencies.missionsStore.updateMission(input.missionId, {
			agentPanes,
			lastError: null,
			sessionName: input.sessionName,
			status: "active",
			workspaceRoot: input.workspaceRoot,
		});
	} catch (error) {
		return input.dependencies.missionsStore.updateMission(input.missionId, {
			agentPanes,
			lastError: getErrorMessage(error, MISSION_SEND_FAILED_MESSAGE),
			sessionName: input.sessionName,
			status: "error",
			workspaceRoot: input.workspaceRoot,
		});
	}
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
		const operationSelectionError = await requireOperationSelection({
			mission: currentMission,
			missionId: input.missionId,
			missionsStore: dependencies.missionsStore,
		});
		if (operationSelectionError) {
			return operationSelectionError;
		}

		const currentWorkflow =
			currentMission?.workflow ?? createEmptyFf15MissionWorkflowState();

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

		const { paneLaunchPlanEntry, runtimeContext, sessionName, workspaceRoot } =
			preparedSend;

		return deliverMissionPrompt({
			currentMission,
			currentWorkflow,
			dependencies,
			missionId: input.missionId,
			paneLaunchPlanEntry,
			prompt,
			runtimeContext,
			sessionName,
			workspaceRoot,
		});
	},
});
