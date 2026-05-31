import type { Uri, Webview, WebviewPanel } from "vscode";
import { ViewColumn, window } from "vscode";
import { getWebviewContent } from "../../lib/webview/get-webview-content";
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
	openMissionSession: (missionId: string) => Promise<unknown>;
	selectMission: (missionId: string) => Promise<unknown>;
}

interface WorkbenchMissionState {
	id: string;
	lastError: string | null;
	operationRef: string | null;
	sessionName: string | null;
	status: Ff15MissionStatus;
	title: string;
	workflow: Ff15MissionWorkflowState;
	workspaceRoot: string | null;
}

interface WorkbenchState {
	mission: WorkbenchMissionState | null;
	operations: Ff15MissionWorkbenchCatalog;
}

interface CreateFf15MissionWorkbenchControllerOptions {
	createWebviewPanel?: typeof window.createWebviewPanel;
	extensionUri: Uri;
	loadOperationsCatalog: (
		workspaceRoot: string | null
	) => Promise<Ff15MissionWorkbenchCatalog> | Ff15MissionWorkbenchCatalog;
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

const toMissionState = (
	mission: ReturnType<Ff15MissionsStore["getMissionRecord"]>
): WorkbenchMissionState | null => {
	if (!mission) {
		return null;
	}

	return {
		id: mission.id,
		lastError: mission.lastError,
		operationRef: mission.operationRef,
		sessionName: mission.sessionName,
		status: mission.status,
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
	const panels = new Map<string, WebviewPanel>();

	const buildState = async (missionId: string): Promise<WorkbenchState> => {
		const mission = options.missionsStore.getMissionRecord(missionId);
		if (!mission) {
			return {
				mission: null,
				operations: EMPTY_CATALOG,
			};
		}

		return {
			mission: toMissionState(mission),
			operations: await options.loadOperationsCatalog(mission.workspaceRoot),
		};
	};

	const postState = async (missionId: string, panel: WebviewPanel) => {
		await panel.webview.postMessage({
			command: "ff15-mission-workbench.state",
			state: await buildState(missionId),
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

	const handlePanelMessage = async (
		missionId: string,
		panel: WebviewPanel,
		message: { command?: string; operationRef?: unknown; prompt?: unknown }
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
