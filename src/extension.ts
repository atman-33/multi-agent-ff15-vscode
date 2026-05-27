import { commands, type ExtensionContext, window } from "vscode";
import { FF15_OPEN_SETTINGS_COMMAND_ID } from "./config/extension-ids";
import { Ff15LaunchViewProvider } from "./features/ff15-launch/provider";
import { resolveActiveWorkspaceRoot } from "./features/ff15-launch/workspace-root";
import { loadBundledOperationsCatalog } from "./features/ff15-operations/catalog";
import { createFf15OperationRuntimeProbeService } from "./features/ff15-operations/runtime-probe";
import { Ff15MissionsViewProvider } from "./features/ff15-missions/provider";
import { createWorkspaceStateFf15MissionsStore } from "./features/ff15-missions/state";
import {
	createVsCodeFf15MissionSendController,
	createVsCodeFf15MissionSessionController,
} from "./features/ff15-missions/vscode-controller";
import { createFf15MissionWorkbenchController } from "./features/ff15-missions/workbench-controller";
import { openFf15Settings } from "./features/ff15-settings/open-settings";
import { Ff15SettingsViewProvider } from "./features/ff15-settings/provider";

let activeRuntimeProbeService: ReturnType<
	typeof createFf15OperationRuntimeProbeService
> | null = null;

export const activate = (context: ExtensionContext) => {
	const ff15LaunchViewProvider = new Ff15LaunchViewProvider(
		context.extensionUri
	);
	const ff15MissionsStore = createWorkspaceStateFf15MissionsStore(
		context.workspaceState,
		{
			getWorkspaceRoot: resolveActiveWorkspaceRoot,
		}
	);
	const ff15MissionSendController =
		createVsCodeFf15MissionSendController(ff15MissionsStore);
	const ff15MissionSessionController = createVsCodeFf15MissionSessionController(
		context.extensionUri,
		ff15MissionsStore
	);
	const ff15OperationRuntimeProbeService =
		createFf15OperationRuntimeProbeService({
			missionsStore: ff15MissionsStore,
		});
	activeRuntimeProbeService = ff15OperationRuntimeProbeService;
	const ff15MissionWorkbenchController = createFf15MissionWorkbenchController({
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
	const ff15SettingsViewProvider = new Ff15SettingsViewProvider(
		context.extensionUri
	);
	context.subscriptions.push(
		window.registerWebviewViewProvider(
			Ff15LaunchViewProvider.viewId,
			ff15LaunchViewProvider
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
