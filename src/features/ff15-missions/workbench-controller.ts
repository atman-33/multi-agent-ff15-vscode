import type { Uri, Webview, WebviewPanel } from "vscode";
import { ViewColumn, window } from "vscode";
import { getWebviewContent } from "../../lib/webview/get-webview-content";
import {
	FF15_AGENT_DISPLAY_NAMES,
	FF15_AGENT_IDS,
	type Ff15AgentId,
	type Ff15LaunchClientId,
} from "../ff15-launch/launch-client";
import {
	FF15_OPENCODE_MODEL_CATALOG,
	resolveFf15MissionModelCatalog,
	resolveFf15MissionProviderAgentModels,
	resolveFf15OpenCodeModelDefinition,
	type Ff15OpenCodeModelDefinition,
} from "./model-contract";
import type {
	Ff15MissionStatus,
	Ff15MissionsStore,
	Ff15MissionWorkflowState,
} from "./state";

export const FF15_MISSION_WORKBENCH_PANEL_VIEW_TYPE =
	"multi-agent-ff15-vscode.missionWorkbench";

export interface Ff15MissionWorkbenchController {
	showMission: (missionId: string) => Promise<void>;
}

export interface Ff15MissionWorkbenchCatalogEntry {
	fileName: string;
	name: string;
	ref: string;
	supported: boolean;
	unavailableReason: string | null;
}

export interface Ff15MissionWorkbenchCatalog {
	supported: Ff15MissionWorkbenchCatalogEntry[];
	unsupported: Ff15MissionWorkbenchCatalogEntry[];
}

interface Ff15MissionSendController {
	submitPrompt: (message: {
		missionId: string;
		prompt: string;
		retry?: boolean;
	}) => Promise<unknown>;
}

interface Ff15MissionSessionController {
	deleteMission: (missionId: string) => Promise<unknown>;
	isMissionTerminalReady?: (missionId: string) => boolean;
	openMissionSession: (missionId: string) => Promise<unknown>;
	renameMission?: (missionId: string, title: string) => Promise<unknown>;
	selectMission: (missionId: string) => Promise<unknown>;
}

interface Ff15MissionAgentActionController {
	changeAgentModel: (input: {
		agentId: Ff15AgentId;
		effort: string | null;
		missionId: string;
		modelId: string;
	}) => Promise<unknown>;
	continueAgent: (input: {
		agentId: Ff15AgentId;
		missionId: string;
	}) => Promise<unknown>;
}

interface WorkbenchMissionState {
	id: string;
	lastError: string | null;
	operationRef: string | null;
	providerId: Ff15LaunchClientId;
	sessionName: string | null;
	status: Ff15MissionStatus;
	terminalReady: boolean;
	title: string;
	workflow: Ff15MissionWorkflowState;
	workspaceRoot: string | null;
}

interface WorkbenchPartyRosterAgent {
	agentId: Ff15AgentId;
	available: boolean;
	displayName: string;
	model: {
		effort: string | null;
		effortLabel: string | null;
		modelId: string;
		modelName: string;
	};
	paneId: string | null;
}

interface WorkbenchState {
	modelCatalog: Ff15OpenCodeModelDefinition[];
	mission: WorkbenchMissionState | null;
	operations: Ff15MissionWorkbenchCatalog;
	partyRoster: WorkbenchPartyRosterAgent[];
}

interface CreateFf15MissionWorkbenchControllerOptions {
	createWebviewPanel?: typeof window.createWebviewPanel;
	extensionUri: Uri;
	loadOperationsCatalog: (
		workspaceRoot: string | null
	) => Promise<Ff15MissionWorkbenchCatalog> | Ff15MissionWorkbenchCatalog;
	modelCatalog?: readonly Ff15OpenCodeModelDefinition[];
	missionAgentActionController?: Ff15MissionAgentActionController;
	missionSendController: Ff15MissionSendController;
	missionSessionController: Ff15MissionSessionController;
	missionsStore: Ff15MissionsStore;
	operationRuntimeProbeService?: {
		ensureMissionRuntime: (missionId: string) => Promise<unknown>;
	};
	renderWebviewContent?: (
		webview: Webview,
		extensionUri: Uri,
		page: string
	) => string;
}

const EMPTY_CATALOG: Ff15MissionWorkbenchCatalog = {
	supported: [],
	unsupported: [],
};

const isFf15AgentId = (value: unknown): value is Ff15AgentId =>
	typeof value === "string" &&
	FF15_AGENT_IDS.some((agentId) => agentId === value);

const toPartyRosterState = (
	mission: ReturnType<Ff15MissionsStore["getMissionRecord"]>,
	modelCatalog: readonly Ff15OpenCodeModelDefinition[]
): WorkbenchPartyRosterAgent[] => {
	if (!mission) {
		return [];
	}

	const providerAgentModels = resolveFf15MissionProviderAgentModels({
		catalog: modelCatalog,
		providerId: mission.providerId,
		providerState: mission.providerState,
	});

	return FF15_AGENT_IDS.map((agentId) => {
		const selection = providerAgentModels?.[agentId] ?? {
			effort: null,
			modelId: mission.providerId,
		};
		const model = resolveFf15OpenCodeModelDefinition(
			selection.modelId,
			modelCatalog
		);
		const effort = model?.efforts.find(
			(option) => option.value === selection.effort
		);
		const paneId = mission.agentPanes[agentId];

		return {
			agentId,
			available: paneId !== null,
			displayName: FF15_AGENT_DISPLAY_NAMES[agentId],
			model: {
				effort: selection.effort,
				effortLabel: effort?.label ?? null,
				modelId: selection.modelId,
				modelName:
					model?.name ??
					(mission.providerId === "opencode"
						? "OpenCode managed"
						: selection.modelId),
			},
			paneId,
		};
	});
};

const toMissionState = (
	mission: ReturnType<Ff15MissionsStore["getMissionRecord"]>,
	terminalReady: boolean
): WorkbenchMissionState | null => {
	if (!mission) {
		return null;
	}

	return {
		id: mission.id,
		lastError: mission.lastError,
		operationRef: mission.operationRef,
		providerId: mission.providerId,
		sessionName: mission.sessionName,
		status: mission.status,
		terminalReady,
		title: mission.title,
		workflow: mission.workflow,
		workspaceRoot: mission.workspaceRoot,
	};
};

export const createFf15MissionWorkbenchController = (
	options: CreateFf15MissionWorkbenchControllerOptions
): Ff15MissionWorkbenchController => {
	const createWebviewPanel =
		options.createWebviewPanel ?? window.createWebviewPanel;
	const renderWebviewContent =
		options.renderWebviewContent ?? getWebviewContent;
	const openCodeModelCatalog = [
		...(options.modelCatalog ?? FF15_OPENCODE_MODEL_CATALOG),
	];
	const panels = new Map<string, WebviewPanel>();

	const buildState = async (missionId: string): Promise<WorkbenchState> => {
		const mission = options.missionsStore.getMissionRecord(missionId);
		if (!mission) {
			return {
				modelCatalog: [],
				mission: null,
				operations: EMPTY_CATALOG,
				partyRoster: [],
			};
		}

		const modelCatalog = resolveFf15MissionModelCatalog(
			mission.providerId,
			openCodeModelCatalog
		);

		return {
			modelCatalog,
			mission: toMissionState(
				mission,
				options.missionSessionController.isMissionTerminalReady?.(missionId) ??
					false
			),
			operations: await options.loadOperationsCatalog(mission.workspaceRoot),
			partyRoster: toPartyRosterState(mission, modelCatalog),
		};
	};

	const postState = async (missionId: string, panel: WebviewPanel) => {
		const state = await buildState(missionId);
		panel.title = state.mission?.title ?? "Mission Workbench";
		await panel.webview.postMessage({
			command: "ff15-mission-workbench.state",
			state,
		});
	};

	const shouldProbeMissionRuntime = (missionId: string) => {
		if (!options.operationRuntimeProbeService) {
			return false;
		}

		const mission = options.missionsStore.getMissionRecord(missionId);
		if (!mission) {
			return false;
		}

		if (!mission.operationRef) {
			return false;
		}

		return mission.workspaceRoot !== null;
	};

	const postStateWithRuntimeProbe = async (
		missionId: string,
		panel: WebviewPanel
	) => {
		if (!shouldProbeMissionRuntime(missionId)) {
			await postState(missionId, panel);
			return;
		}

		const ensureMissionRuntime =
			options.operationRuntimeProbeService?.ensureMissionRuntime(missionId);
		await postState(missionId, panel);
		await ensureMissionRuntime;
		await postState(missionId, panel);
	};

	const handlePromptMessage = async (
		missionId: string,
		panel: WebviewPanel,
		message: { command: string; prompt?: unknown }
	) => {
		if (typeof message.prompt !== "string") {
			return;
		}

		const prompt = message.prompt.trim();
		if (prompt.length === 0) {
			return;
		}

		await options.missionSendController.submitPrompt({
			missionId,
			prompt,
			retry: message.command === "ff15-mission-workbench.retry",
		});
		await postState(missionId, panel);
	};

	const handleSelectOperationMessage = async (
		missionId: string,
		panel: WebviewPanel,
		message: { operationRef?: unknown }
	) => {
		if (typeof message.operationRef !== "string") {
			return;
		}

		const state = await buildState(missionId);
		if (
			!state.operations.supported.some(
				(operation) => operation.ref === message.operationRef
			)
		) {
			return;
		}

		await options.missionsStore.updateMission(missionId, {
			lastError: null,
			operationRef: message.operationRef,
		});
		await postStateWithRuntimeProbe(missionId, panel);
	};

	const handleRenameTitleMessage = async (
		missionId: string,
		panel: WebviewPanel,
		message: { title?: unknown }
	) => {
		if (typeof message.title !== "string") {
			return;
		}

		if (options.missionSessionController.renameMission) {
			await options.missionSessionController.renameMission(
				missionId,
				message.title
			);
		} else {
			await options.missionsStore.updateMission(missionId, {
				title: message.title,
			});
		}
		await postState(missionId, panel);
	};

	const handleContinueAgentMessage = async (
		missionId: string,
		panel: WebviewPanel,
		message: { agentId?: unknown }
	) => {
		if (
			!(options.missionAgentActionController && isFf15AgentId(message.agentId))
		) {
			return;
		}

		await options.missionAgentActionController.continueAgent({
			agentId: message.agentId,
			missionId,
		});
		await postState(missionId, panel);
	};

	const handleChangeAgentModelMessage = async (
		missionId: string,
		panel: WebviewPanel,
		message: { agentId?: unknown; effort?: unknown; modelId?: unknown }
	) => {
		if (
			!(
				options.missionAgentActionController &&
				isFf15AgentId(message.agentId) &&
				typeof message.modelId === "string" &&
				(message.effort === null || typeof message.effort === "string")
			)
		) {
			return;
		}

		const mission = options.missionsStore.getMissionRecord(missionId);
		if (
			!mission ||
			resolveFf15MissionModelCatalog(mission.providerId, openCodeModelCatalog)
				.length === 0
		) {
			return;
		}

		await options.missionAgentActionController.changeAgentModel({
			agentId: message.agentId,
			effort: message.effort,
			missionId,
			modelId: message.modelId,
		});
		await postState(missionId, panel);
	};

	const handlePanelMessage = async (
		missionId: string,
		panel: WebviewPanel,
		message: {
			agentId?: unknown;
			command?: string;
			effort?: unknown;
			modelId?: unknown;
			operationRef?: unknown;
			prompt?: unknown;
			title?: unknown;
		}
	) => {
		switch (message.command) {
			case "ff15-mission-workbench.ready": {
				await postStateWithRuntimeProbe(missionId, panel);
				return;
			}
			case "ff15-mission-workbench.delete": {
				await options.missionSessionController.deleteMission(missionId);
				panels.delete(missionId);
				panel.dispose();
				return;
			}
			case "ff15-mission-workbench.open-terminal": {
				await options.missionSessionController.openMissionSession(missionId);
				await postState(missionId, panel);
				return;
			}
			case "ff15-mission-workbench.retry":
			case "ff15-mission-workbench.send": {
				await handlePromptMessage(missionId, panel, message);
				return;
			}
			case "ff15-mission-workbench.select-operation": {
				await handleSelectOperationMessage(missionId, panel, message);
				return;
			}
			case "ff15-mission-workbench.rename-title": {
				await handleRenameTitleMessage(missionId, panel, message);
				return;
			}
			case "ff15-mission-workbench.continue-agent": {
				await handleContinueAgentMessage(missionId, panel, message);
				return;
			}
			case "ff15-mission-workbench.change-agent-model": {
				await handleChangeAgentModelMessage(missionId, panel, message);
				return;
			}
			default:
				return;
		}
	};

	const bindPanelMessages = (missionId: string, panel: WebviewPanel) => {
		panel.webview.onDidReceiveMessage(async (message) => {
			await handlePanelMessage(missionId, panel, message);
		});
	};

	return {
		showMission: async (missionId: string) => {
			const existingPanel = panels.get(missionId);
			if (existingPanel) {
				await postState(missionId, existingPanel);
				existingPanel.reveal(ViewColumn.Active, false);
				return;
			}

			const mission = options.missionsStore.getMissionRecord(missionId);
			const panel = createWebviewPanel(
				FF15_MISSION_WORKBENCH_PANEL_VIEW_TYPE,
				mission?.title ?? "Mission Workbench",
				ViewColumn.Active,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
				}
			);

			panel.title = mission?.title ?? "Mission Workbench";
			panel.webview.html = renderWebviewContent(
				panel.webview,
				options.extensionUri,
				"ff15-mission-workbench"
			);
			panels.set(missionId, panel);
			panel.onDidDispose(() => {
				panels.delete(missionId);
			});
			bindPanelMessages(missionId, panel);
			await postState(missionId, panel);
		},
	};
};
