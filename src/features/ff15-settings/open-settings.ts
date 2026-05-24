import { commands } from "vscode";

export const FF15_SETTINGS_QUERY = "multi-agent-ff15-vscode";

export const openFf15Settings = async () => {
	await commands.executeCommand(
		"workbench.action.openSettings",
		FF15_SETTINGS_QUERY
	);
};
