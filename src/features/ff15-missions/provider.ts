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
import type { Ff15MissionWorkbenchController } from "./workbench-controller";

const FF15_MISSIONS_PAGE_ID = "ff15-missions";

interface Ff15MissionSendController {
	submitPrompt: (input: {
		missionId: string;
		prompt: string;
	}) => Promise<Ff15MissionsStoreSnapshot>;
}

interface Ff15MissionSessionController {
	createMission: () => Promise<Ff15MissionsStoreSnapshot>;
	deleteMission: (missionId: string) => Promise<Ff15MissionsStoreSnapshot>;
	selectMission: (missionId: string) => Promise<Ff15MissionsStoreSnapshot>;
}

interface Ff15MissionsViewProviderControllers {
	missionSendController?: Ff15MissionSendController;
	missionSessionController?: Ff15MissionSessionController;
	missionWorkbenchController?: Ff15MissionWorkbenchController;
}

export class Ff15MissionsViewProvider implements WebviewViewProvider {
	static readonly viewId = FF15_MISSIONS_VIEW_ID;

	private readonly extensionUri: Uri;
	private readonly missionsStore: Ff15MissionsStore;
	private readonly missionSendController: Ff15MissionSendController;
	private readonly missionSessionController: Ff15MissionSessionController;
	private readonly missionWorkbenchController: Ff15MissionWorkbenchController;
	private view?: WebviewView;

	constructor(
		extensionUri: Uri,
		missionsStore: Ff15MissionsStore,
		controllers: Ff15MissionsViewProviderControllers = {}
	) {
		this.extensionUri = extensionUri;
		this.missionsStore = missionsStore;
		this.missionSendController = controllers.missionSendController ?? {
			submitPrompt: () => Promise.resolve(missionsStore.getSnapshot()),
		};
		this.missionSessionController = controllers.missionSessionController ?? {
			createMission: () => missionsStore.createMission(),
			deleteMission: (missionId: string) =>
				missionsStore.deleteMission(missionId),
			selectMission: (missionId: string) =>
				missionsStore.selectMission(missionId),
		};
		this.missionWorkbenchController =
			controllers.missionWorkbenchController ?? {
				showMission: () => Promise.resolve(),
			};
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
					this.postSnapshot(
						await this.openMissionWorkbench(
							await this.missionSessionController.createMission()
						)
					);
					return;
				}
				case "ff15-missions.delete": {
					if (typeof message.missionId !== "string") {
						return;
					}

					this.postSnapshot(
						await this.missionSessionController.deleteMission(message.missionId)
					);
					return;
				}
				case "ff15-missions.ready": {
					this.postSnapshot(this.missionsStore.getSnapshot());
					return;
				}
				case "ff15-missions.retry":
				case "ff15-missions.send": {
					if (
						typeof message.missionId !== "string" ||
						typeof message.prompt !== "string"
					) {
						return;
					}

					this.postSnapshot(
						await this.missionSendController.submitPrompt({
							missionId: message.missionId,
							prompt: message.prompt,
						})
					);
					return;
				}
				case "ff15-missions.select": {
					if (typeof message.missionId !== "string") {
						return;
					}

					this.postSnapshot(
						await this.openMissionWorkbench(
							await this.missionSessionController.selectMission(
								message.missionId
							)
						)
					);
					return;
				}
				default:
					return;
			}
		});

		this.postSnapshot(this.missionsStore.getSnapshot());
	}

	private async openMissionWorkbench(snapshot: Ff15MissionsStoreSnapshot) {
		if (snapshot.activeMissionId) {
			await this.missionWorkbenchController.showMission(
				snapshot.activeMissionId
			);
		}

		return snapshot;
	}

	private postSnapshot(snapshot: Ff15MissionsStoreSnapshot) {
		this.view?.webview.postMessage({
			command: "ff15-missions.state",
			snapshot,
		});
	}
}
