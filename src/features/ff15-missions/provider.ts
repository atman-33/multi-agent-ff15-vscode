import type {
	CancellationToken,
	Uri,
	WebviewView,
	WebviewViewProvider,
	WebviewViewResolveContext,
} from "vscode";
import { FF15_MISSIONS_VIEW_ID } from "../../config/extension-ids";
import { getWebviewContent } from "../../lib/webview/get-webview-content";
import type { Ff15MissionsStore, Ff15MissionsStoreSnapshot } from "./state";

const FF15_MISSIONS_PAGE_ID = "ff15-missions";

export class Ff15MissionsViewProvider implements WebviewViewProvider {
	static readonly viewId = FF15_MISSIONS_VIEW_ID;

	private readonly extensionUri: Uri;
	private readonly missionsStore: Ff15MissionsStore;
	private view?: WebviewView;

	constructor(extensionUri: Uri, missionsStore: Ff15MissionsStore) {
		this.extensionUri = extensionUri;
		this.missionsStore = missionsStore;
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
			FF15_MISSIONS_PAGE_ID
		);

		webviewView.webview.onDidReceiveMessage(async (message) => {
			switch (message.command) {
				case "ff15-missions.create": {
					this.postSnapshot(await this.missionsStore.createMission());
					return;
				}
				case "ff15-missions.ready": {
					this.postSnapshot(this.missionsStore.getSnapshot());
					return;
				}
				case "ff15-missions.select": {
					if (typeof message.missionId !== "string") {
						return;
					}

					this.postSnapshot(
						await this.missionsStore.selectMission(message.missionId)
					);
					return;
				}
				default:
					return;
			}
		});

		this.postSnapshot(this.missionsStore.getSnapshot());
	}

	private postSnapshot(snapshot: Ff15MissionsStoreSnapshot) {
		this.view?.webview.postMessage({
			command: "ff15-missions.state",
			snapshot,
		});
	}
}
