import type {
	CancellationToken,
	Uri,
	WebviewView,
	WebviewViewProvider,
	WebviewViewResolveContext,
} from "vscode";
import { FF15_LAUNCH_VIEW_ID } from "../../config/extension-ids";
import { getWebviewContent } from "../../lib/webview/get-webview-content";
import { createVsCodeFf15LaunchController } from "./vscode-controller";

export class Ff15LaunchViewProvider implements WebviewViewProvider {
	static readonly viewId = FF15_LAUNCH_VIEW_ID;

	private readonly extensionUri: Uri;
	private readonly launchController = createVsCodeFf15LaunchController();
	private view?: WebviewView;

	constructor(extensionUri: Uri) {
		this.extensionUri = extensionUri;
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
			"ff15-launch"
		);

		webviewView.webview.onDidReceiveMessage(async (message) => {
			switch (message.command) {
				case "ff15-launch.start": {
					this.postStatus({
						message: "Checking dependencies and opening Zellij...",
						state: "launching",
					});

					const result = await this.launchController.launch();
					this.postStatus({
						message:
							result.status === "launched"
								? `FF15 launch started in ${result.cwd}`
								: (result.message ?? "FF15 launch failed."),
						state: result.status,
					});
					return;
				}
				default:
					return;
			}
		});
	}

	private postStatus(payload: {
		message: string;
		state: "error" | "launched" | "launching";
	}) {
		this.view?.webview.postMessage({
			command: "ff15-launch.status",
			...payload,
		});
	}
}
