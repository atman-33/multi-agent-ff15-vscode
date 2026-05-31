import type {
	CancellationToken,
	Uri,
	WebviewView,
	WebviewViewProvider,
	WebviewViewResolveContext,
} from "vscode";
import { commands } from "vscode";
import {
	FF15_OPEN_SETTINGS_COMMAND_ID,
	FF15_SETTINGS_VIEW_ID,
} from "../../config/extension-ids";
import { getWebviewContent } from "../../lib/webview/get-webview-content";
import { createVsCodeFf15LaunchController } from "../ff15-launch/vscode-controller";

const FF15_SETTINGS_PAGE_ID = "ff15-settings";

export class Ff15SettingsViewProvider implements WebviewViewProvider {
	static readonly viewId = FF15_SETTINGS_VIEW_ID;

	private readonly extensionUri: Uri;
	private readonly launchController: ReturnType<
		typeof createVsCodeFf15LaunchController
	>;
	private readonly openSettingsCommand: () => Promise<unknown>;
	private view?: WebviewView;

	constructor(
		extensionUri: Uri,
		openSettingsCommand: () => Promise<unknown> = () =>
			commands.executeCommand(FF15_OPEN_SETTINGS_COMMAND_ID),
		launchController: ReturnType<
			typeof createVsCodeFf15LaunchController
		> = createVsCodeFf15LaunchController(extensionUri)
	) {
		this.extensionUri = extensionUri;
		this.launchController = launchController;
		this.openSettingsCommand = openSettingsCommand;
	}

	resolveWebviewView(
		webviewView: WebviewView,
		_context: WebviewViewResolveContext,
		_token: CancellationToken
	) {
		this.view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri],
		};

		webviewView.webview.html = getWebviewContent(
			webviewView.webview,
			this.extensionUri,
			FF15_SETTINGS_PAGE_ID
		);

		webviewView.webview.onDidReceiveMessage(async (message) => {
			switch (message.command) {
				case "ff15-launch.start": {
					this.postLaunchStatus({
						message: "Checking dependencies and opening Zellij...",
						state: "launching",
					});

					const result = await this.launchController.launch();
					this.postLaunchStatus({
						message:
							result.status === "launched"
								? `FF15 launch started in ${result.cwd}`
								: (result.message ?? "FF15 launch failed."),
						state: result.status,
					});
					return;
				}
				case "ff15-settings.open": {
					await this.openSettingsCommand();
					return;
				}
				default:
					return;
			}
		});
	}

	private postLaunchStatus(payload: {
		message: string;
		state: "error" | "launched" | "launching";
	}) {
		this.view?.webview.postMessage({
			command: "ff15-launch.status",
			...payload,
		});
	}
}
