import { commands, ExtensionMode, type ExtensionContext, window } from "vscode";
import { FF15_OPEN_SETTINGS_COMMAND_ID } from "./config/extension-ids";
import { materializeBundledFf15WorkspaceTemplateFiles } from "./features/ff15-agents/materialize";
import { resolveActiveWorkspaceRoot } from "./features/ff15-launch/workspace-root";
import { loadBundledOperationsCatalog } from "./features/ff15-operations/catalog";
import { createFf15OperationRuntimeProbeService } from "./features/ff15-operations/runtime-probe";
import { Ff15MissionsViewProvider } from "./features/ff15-missions/provider";
import { createFf15MissionAgentActionController } from "./features/ff15-missions/agent-actions";
import { createFf15OpenCodeModelCatalogLoader } from "./features/ff15-missions/opencode-model-catalog";
import { createWorkspaceStateFf15MissionsStore } from "./features/ff15-missions/state";
import { createFf15MissionZellijTransport } from "./features/ff15-missions/transport";
import {
	createVsCodeFf15MissionSendController,
	createVsCodeFf15MissionSessionController,
} from "./features/ff15-missions/vscode-controller";
import { createFf15MissionWorkbenchController } from "./features/ff15-missions/workbench-controller";
import {
	resolveFf15ProjectsContext,
	saveFf15ProjectsContext,
} from "./features/ff15-projects/context-resolver";
import { resolveFf15ProjectRuntimeContext } from "./features/ff15-projects/runtime-context";
import { Ff15ProjectsViewProvider } from "./features/ff15-projects/provider";
import { createFf15ProjectsWorkbenchController } from "./features/ff15-projects/workbench-controller";
import { openFf15Settings } from "./features/ff15-settings/open-settings";
import { Ff15SettingsViewProvider } from "./features/ff15-settings/provider";

let activeRuntimeProbeService: ReturnType<
	typeof createFf15OperationRuntimeProbeService
> | null = null;

export const activate = (context: ExtensionContext) => {
	const isDevMode = context.extensionMode === ExtensionMode.Development;
	const activationWorkspaceRoot = resolveActiveWorkspaceRoot();
	if (activationWorkspaceRoot) {
		materializeBundledFf15WorkspaceTemplateFiles({
			extensionRoot: context.extensionUri.fsPath,
			workspaceRoot: activationWorkspaceRoot,
		});
	}

	const ff15MissionsStore = createWorkspaceStateFf15MissionsStore(
		context.workspaceState,
		{
			getWorkspaceRoot: resolveActiveWorkspaceRoot,
		}
	);
	const ff15OpenCodeModelCatalogLoader = createFf15OpenCodeModelCatalogLoader();
	const ff15MissionTransport = createFf15MissionZellijTransport();
	const ff15MissionSessionController = createVsCodeFf15MissionSessionController(
		context.extensionUri,
		ff15MissionsStore,
		ff15MissionTransport
	);
	const ff15MissionSendController = createVsCodeFf15MissionSendController(
		ff15MissionsStore,
		ff15MissionTransport,
		ff15MissionSessionController.isMissionTerminalReady
	);
	const ff15MissionAgentActionController =
		createFf15MissionAgentActionController({
			loadOpenCodeModelCatalog: (workspaceRoot) =>
				ff15OpenCodeModelCatalogLoader.readCatalog({
					waitForLatest: true,
					workspaceRoot,
				}),
			missionTransport: ff15MissionTransport,
			missionsStore: ff15MissionsStore,
		});
	const ff15OperationRuntimeProbeService =
		createFf15OperationRuntimeProbeService({
			missionTransport: ff15MissionTransport,
			missionsStore: ff15MissionsStore,
			resolveRuntimeContext: ({ workspaceRoot }) =>
				resolveFf15ProjectRuntimeContext({ workspaceRoot }),
		});
	activeRuntimeProbeService = ff15OperationRuntimeProbeService;
	const ff15MissionWorkbenchController = createFf15MissionWorkbenchController({
		loadOpenCodeModelCatalog: (workspaceRoot) =>
			ff15OpenCodeModelCatalogLoader.readCatalog({
				waitForLatest: true,
				workspaceRoot,
			}),
		missionAgentActionController: ff15MissionAgentActionController,
		missionSendController: ff15MissionSendController,
		missionSessionController: ff15MissionSessionController,
		missionsStore: ff15MissionsStore,
		operationRuntimeProbeService: ff15OperationRuntimeProbeService,
		extensionUri: context.extensionUri,
		loadOperationsCatalog: (workspaceRoot) =>
			loadBundledOperationsCatalog({
				extensionRoot: context.extensionUri.fsPath,
				workspaceRoot,
			}),
	});
	const ff15MissionsViewProvider = new Ff15MissionsViewProvider(
		context.extensionUri,
		ff15MissionsStore,
		{
			missionSendController: ff15MissionSendController,
			missionSessionController: ff15MissionSessionController,
			missionWorkbenchController: ff15MissionWorkbenchController,
		}
	);
	const ff15ProjectsWorkbenchController = createFf15ProjectsWorkbenchController(
		{
			extensionUri: context.extensionUri,
			resolveProjectsContext: resolveFf15ProjectsContext,
			saveProjectsContext: saveFf15ProjectsContext,
		}
	);
	const ff15ProjectsViewProvider = new Ff15ProjectsViewProvider(
		context.extensionUri,
		{
			devMode: isDevMode,
			projectsWorkbenchController: ff15ProjectsWorkbenchController,
		}
	);
	const ff15SettingsViewProvider = new Ff15SettingsViewProvider(
		context.extensionUri
	);
	context.subscriptions.push(
		window.registerWebviewViewProvider(
			Ff15ProjectsViewProvider.viewId,
			ff15ProjectsViewProvider
		),
		window.registerWebviewViewProvider(
			Ff15MissionsViewProvider.viewId,
			ff15MissionsViewProvider
		),
		window.registerWebviewViewProvider(
			Ff15SettingsViewProvider.viewId,
			ff15SettingsViewProvider
		),
		commands.registerCommand(FF15_OPEN_SETTINGS_COMMAND_ID, openFf15Settings)
	);
};

export async function deactivate() {
	if (!activeRuntimeProbeService) {
		return;
	}

	await activeRuntimeProbeService.dispose();
	activeRuntimeProbeService = null;
}
