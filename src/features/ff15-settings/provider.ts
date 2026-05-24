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

const FF15_SETTINGS_PAGE_ID = "ff15-settings";

export class Ff15SettingsViewProvider implements WebviewViewProvider {
	static readonly viewId = FF15_SETTINGS_VIEW_ID;

	private readonly extensionUri: Uri;
	private readonly openSettingsCommand: () => Promise<unknown>;

	constructor(
		extensionUri: Uri,
		openSettingsCommand: () => Promise<unknown> = () =>
			commands.executeCommand(FF15_OPEN_SETTINGS_COMMAND_ID)
	) {
		this.extensionUri = extensionUri;
		this.openSettingsCommand = openSettingsCommand;
	}

	resolveWebviewView(
		webviewView: WebviewView,
		_context: WebviewViewResolveContext,
		_token: CancellationToken
	) {
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
			if (message.command === "ff15-settings.open") {
				await this.openSettingsCommand();
			}
		});
	}
}
