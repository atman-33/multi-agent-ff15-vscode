import { type ExtensionContext, window } from "vscode";
import { Ff15LaunchViewProvider } from "./features/ff15-launch/provider";

export const activate = (context: ExtensionContext) => {
	const ff15LaunchViewProvider = new Ff15LaunchViewProvider(
		context.extensionUri
	);
	context.subscriptions.push(
		window.registerWebviewViewProvider(
			Ff15LaunchViewProvider.viewId,
			ff15LaunchViewProvider
		)
	);
};

// this method is called when your extension is deactivated
// biome-ignore lint/suspicious/noEmptyBlockStatements: ignore
export function deactivate() {}
