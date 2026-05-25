import { commands, type ExtensionContext, window } from "vscode";
import { FF15_OPEN_SETTINGS_COMMAND_ID } from "./config/extension-ids";
import { Ff15LaunchViewProvider } from "./features/ff15-launch/provider";
import { Ff15MissionsViewProvider } from "./features/ff15-missions/provider";
import { createWorkspaceStateFf15MissionsStore } from "./features/ff15-missions/state";
import { openFf15Settings } from "./features/ff15-settings/open-settings";
import { Ff15SettingsViewProvider } from "./features/ff15-settings/provider";

export const activate = (context: ExtensionContext) => {
	const ff15LaunchViewProvider = new Ff15LaunchViewProvider(
		context.extensionUri
	);
	const ff15MissionsStore = createWorkspaceStateFf15MissionsStore(
		context.workspaceState
	);
	const ff15MissionsViewProvider = new Ff15MissionsViewProvider(
		context.extensionUri,
		ff15MissionsStore
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

// this method is called when your extension is deactivated
// biome-ignore lint/suspicious/noEmptyBlockStatements: ignore
export function deactivate() {}
