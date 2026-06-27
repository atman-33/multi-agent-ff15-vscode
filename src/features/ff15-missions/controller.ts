import { createHash } from "node:crypto";
import type { Disposable } from "vscode";
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
	FF15_MISSION_PROVIDER_MISSING_NOCTIS_PLAN_MESSAGE,
	resolveFf15MissionProviderAdapter,
} from "./mission-provider-adapter";
import {
	isGeneratedMissionTitle,
	normalizeMissionTitle,
	createEmptyFf15MissionAgentPanes,
	createEmptyFf15MissionWorkflowState,
	type Ff15MissionAgentPanes,
	type Ff15MissionRecord,
	type Ff15MissionsStore,
} from "./state";

export const MISSING_WORKSPACE_MESSAGE =
	"Open a workspace folder before messaging Noctis.";
export const MISSING_ZELLIJ_MESSAGE =
	"Messaging Noctis requires `zellij` on PATH.";
export const MISSING_NOCTIS_PLAN_MESSAGE =
	FF15_MISSION_PROVIDER_MISSING_NOCTIS_PLAN_MESSAGE;
export const MISSING_OPERATION_SELECTION_MESSAGE =
	"Select an operation before sending a mission prompt.";
export const MISSION_SEND_FAILED_MESSAGE =
	"FF15 could not deliver the prompt to Noctis.";
export const MISSION_TERMINAL_NOT_READY_MESSAGE =
	"Launch Terminal before sending a prompt to Noctis.";

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
	getLaunchClient: (mission: Ff15MissionRecord) => Ff15LaunchClient;
	getWorkspaceRoot: () => string | undefined;
	isMissionTerminalReady?: (missionId: string) => boolean;
	missionTransport: Ff15MissionTransport;
	missionsStore: Ff15MissionsStore;
	resolveRuntimeContext?: (input: { workspaceRoot: string }) => {
		activeProjects: string[];
		executionRoot: string;
		languageName: "en" | "ja";
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
	languageName?: "en" | "ja";
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
			settings: { languageName: input.languageName },
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
			launchClient: Ff15LaunchClient;
			paneLaunchPlanEntry?: Ff15PaneLaunchPlanEntry;
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
		languageName: "en" as const,
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

	if (!currentMission) {
		return {
			result: dependencies.missionsStore.getSnapshot(),
		};
	}

	const launchClient = dependencies.getLaunchClient(currentMission);

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
		launchClient,
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

const deriveMissionTitleFromPrompt = (input: {
	currentMission: ReturnType<Ff15MissionsStore["getMissionRecord"]>;
	prompt: string;
}) => {
	if (!input.currentMission) {
		return null;
	}

	if (!isGeneratedMissionTitle(input.currentMission.title)) {
		return null;
	}

	return normalizeMissionTitle(input.prompt);
};

const requireMissionTerminalReady = (input: {
	isMissionTerminalReady?: (missionId: string) => boolean;
	missionId: string;
	missionsStore: Ff15MissionsStore;
}) => {
	if (!input.isMissionTerminalReady) {
		return null;
	}

	if (!input.isMissionTerminalReady(input.missionId)) {
		return input.missionsStore.updateMission(input.missionId, {
			lastError: MISSION_TERMINAL_NOT_READY_MESSAGE,
		});
	}

	return null;
};

const deliverMissionPrompt = async (input: {
	currentMission: ReturnType<Ff15MissionsStore["getMissionRecord"]>;
	currentWorkflow: ReturnType<typeof createEmptyFf15MissionWorkflowState>;
	dependencies: CreateFf15MissionSendControllerDependencies;
	launchClient: Ff15LaunchClient;
	missionId: string;
	paneLaunchPlanEntry?: Ff15PaneLaunchPlanEntry;
	prompt: string;
	runtimeContext: {
		activeProjects: string[];
		executionRoot: string;
		languageName: "en" | "ja";
		openspecRoot: string | null;
	};
	sessionName: string;
	workspaceRoot: string;
}) => {
	let agentPanes =
		input.currentMission?.agentPanes ?? createEmptyFf15MissionAgentPanes();
	const derivedTitle = deriveMissionTitleFromPrompt({
		currentMission: input.currentMission,
		prompt: input.prompt,
	});
	const operationWorkflowActivation = input.currentMission?.operationRef
		? activateOperationWorkflow({
				activeProjects: input.runtimeContext.activeProjects,
				languageName: input.runtimeContext.languageName,
				missionId: input.missionId,
				openspecRoot: input.runtimeContext.openspecRoot,
				operationRef: input.currentMission.operationRef,
				prompt: input.prompt,
				workflow: input.currentWorkflow,
				workspaceRoot: input.workspaceRoot,
			})
		: null;

	try {
		if (operationWorkflowActivation) {
			await input.dependencies.missionsStore.updateMission(input.missionId, {
				agentPanes,
				lastError: null,
				sessionName: input.sessionName,
				status: "sending",
				workflow: operationWorkflowActivation.workflow,
				workspaceRoot: input.workspaceRoot,
			});

			const adapter = resolveFf15MissionProviderAdapter(
				input.currentMission.providerId
			);
			const delivery = await adapter.deliverOperationActivationPrompt({
				agentPanes,
				allowCreateNoctisPane: input.currentMission.sessionName == null,
				launchClient: input.launchClient,
				missionId: input.missionId,
				prompt: operationWorkflowActivation.prompt,
				sessionName: input.sessionName,
				transport: input.dependencies.missionTransport,
				workspaceRoot: input.workspaceRoot,
			});
			agentPanes = delivery.agentPanes;
		} else {
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

			await input.dependencies.missionTransport.sendPrompt({
				paneId,
				prompt: input.prompt,
				sessionName: input.sessionName,
			});
		}

		return input.dependencies.missionsStore.updateMission(input.missionId, {
			agentPanes,
			lastError: null,
			sessionName: input.sessionName,
			status: "active",
			...(derivedTitle ? { title: derivedTitle } : {}),
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
) => {
	const missionSnapshotListeners = new Set<
		(snapshot: ReturnType<Ff15MissionsStore["getSnapshot"]>) => void
	>();

	const notifyMissionSnapshotChanged = (
		snapshot: ReturnType<Ff15MissionsStore["getSnapshot"]>
	) => {
		for (const listener of missionSnapshotListeners) {
			listener(snapshot);
		}
	};

	return {
		onDidChangeMissionSnapshot: (
			listener: (snapshot: ReturnType<Ff15MissionsStore["getSnapshot"]>) => void
		): Disposable => {
			missionSnapshotListeners.add(listener);
			return {
				dispose: () => {
					missionSnapshotListeners.delete(listener);
				},
			};
		},
		async submitPrompt(input: { missionId: string; prompt: string }) {
			const prompt = input.prompt.trim();
			if (prompt.length === 0) {
				const snapshot = dependencies.missionsStore.getSnapshot();
				notifyMissionSnapshotChanged(snapshot);
				return snapshot;
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
				notifyMissionSnapshotChanged(operationSelectionError);
				return operationSelectionError;
			}

			const terminalReadyError = await requireMissionTerminalReady({
				isMissionTerminalReady: dependencies.isMissionTerminalReady,
				missionId: input.missionId,
				missionsStore: dependencies.missionsStore,
			});
			if (terminalReadyError) {
				notifyMissionSnapshotChanged(terminalReadyError);
				return terminalReadyError;
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
				notifyMissionSnapshotChanged(preparedSend.result);
				return preparedSend.result;
			}

			const {
				launchClient,
				paneLaunchPlanEntry,
				runtimeContext,
				sessionName,
				workspaceRoot,
			} = preparedSend;

			const snapshot = await deliverMissionPrompt({
				currentMission,
				currentWorkflow,
				dependencies,
				launchClient,
				missionId: input.missionId,
				paneLaunchPlanEntry,
				prompt,
				runtimeContext,
				sessionName,
				workspaceRoot,
			});
			notifyMissionSnapshotChanged(snapshot);
			return snapshot;
		},
	};
};
