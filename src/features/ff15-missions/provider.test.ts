import { beforeEach, describe, expect, it, vi } from "vitest";
import { Ff15MissionsViewProvider } from "./provider";

vi.mock("../../lib/webview/get-webview-content", () => ({
	getWebviewContent: vi
		.fn()
		.mockReturnValue('<div id="root" data-page="ff15-missions"></div>'),
}));

describe("Ff15MissionsViewProvider", () => {
	let messageHandler:
		| ((message: {
				command?: string;
				missionId?: string;
				prompt?: string;
		  }) => void | Promise<void>)
		| undefined;
	let missionSnapshotListener:
		| ((snapshot: {
				activeMissionId: string | null;
				missions: unknown[];
		  }) => void)
		| undefined;

	beforeEach(() => {
		messageHandler = undefined;
		missionSnapshotListener = undefined;
	});

	it("renders the FF15 missions page and posts the initial mission snapshot", () => {
		const missionsStore = {
			getSnapshot: vi.fn().mockReturnValue({
				activeMissionId: null,
				missions: [],
			}),
		};
		const provider = new Ff15MissionsViewProvider(
			{} as never,
			missionsStore as never
		);
		const webviewView = {
			webview: {
				html: "",
				localResourceRoots: [],
				options: undefined,
				postMessage: vi.fn(),
				onDidReceiveMessage: vi.fn((listener) => {
					messageHandler = listener;
					return { dispose: vi.fn() };
				}),
			},
		};

		provider.resolveWebviewView(webviewView as never, {} as never, {} as never);

		expect(webviewView.webview.html).toContain('data-page="ff15-missions"');
		expect(messageHandler).toBeTypeOf("function");
		expect(missionsStore.getSnapshot).toHaveBeenCalledTimes(1);
		expect(webviewView.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-missions.state",
			devMode: false,
			snapshot: {
				activeMissionId: null,
				missions: [],
			},
		});
	});

	it("creates, selects, and deletes missions through the mission session controller", async () => {
		const emptySnapshot = {
			activeMissionId: null,
			missions: [],
		};
		const createdSnapshot = {
			activeMissionId: "mission-1",
			missions: [
				{
					createdAt: "2026-05-25T00:00:00.000Z",
					id: "mission-1",
					title: "Mission 1",
					updatedAt: "2026-05-25T00:00:00.000Z",
				},
			],
		};
		const selectedSnapshot = {
			activeMissionId: "mission-2",
			missions: [
				createdSnapshot.missions[0],
				{
					createdAt: "2026-05-25T00:01:00.000Z",
					id: "mission-2",
					title: "Mission 2",
					updatedAt: "2026-05-25T00:01:00.000Z",
				},
			],
		};
		const deletedSnapshot = {
			activeMissionId: "mission-1",
			missions: [createdSnapshot.missions[0]],
		};
		const missionsStore = {
			getSnapshot: vi.fn().mockReturnValue(emptySnapshot),
		};
		const missionSessionController = {
			createMission: vi.fn().mockImplementation(() => {
				missionSnapshotListener?.(createdSnapshot);
				return createdSnapshot;
			}),
			deleteMission: vi.fn().mockImplementation(() => {
				missionSnapshotListener?.(deletedSnapshot);
				return deletedSnapshot;
			}),
			onDidChangeMissionSnapshot: vi.fn((listener) => {
				missionSnapshotListener = listener;
				return { dispose: vi.fn() };
			}),
			selectMission: vi.fn().mockImplementation(() => {
				missionSnapshotListener?.(selectedSnapshot);
				return selectedSnapshot;
			}),
		};
		const missionWorkbenchController = {
			showMission: vi.fn(),
		};
		const provider = new Ff15MissionsViewProvider(
			{} as never,
			missionsStore as never,
			{
				missionSessionController: missionSessionController as never,
				missionWorkbenchController: missionWorkbenchController as never,
			}
		);
		const webviewView = {
			webview: {
				html: "",
				localResourceRoots: [],
				options: undefined,
				postMessage: vi.fn(),
				onDidReceiveMessage: vi.fn((listener) => {
					messageHandler = listener;
					return { dispose: vi.fn() };
				}),
			},
		};

		provider.resolveWebviewView(webviewView as never, {} as never, {} as never);

		await messageHandler?.({ command: "ff15-missions.create" });
		await messageHandler?.({
			command: "ff15-missions.select",
			missionId: "mission-2",
		});
		await messageHandler?.({
			command: "ff15-missions.delete",
			missionId: "mission-2",
		});

		expect(missionSessionController.createMission).toHaveBeenCalledTimes(1);
		expect(missionSessionController.selectMission).toHaveBeenCalledWith(
			"mission-2"
		);
		expect(missionSessionController.deleteMission).toHaveBeenCalledWith(
			"mission-2"
		);
		expect(missionWorkbenchController.showMission).toHaveBeenNthCalledWith(
			1,
			"mission-1"
		);
		expect(missionWorkbenchController.showMission).toHaveBeenNthCalledWith(
			2,
			"mission-2"
		);
		expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(2, {
			command: "ff15-missions.state",
			devMode: false,
			snapshot: createdSnapshot,
		});
		expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(3, {
			command: "ff15-missions.state",
			devMode: false,
			snapshot: selectedSnapshot,
		});
		expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(4, {
			command: "ff15-missions.state",
			devMode: false,
			snapshot: deletedSnapshot,
		});
	});

	it("refreshes the sidebar snapshot when the mission session controller reports an external change", () => {
		const initialSnapshot = {
			activeMissionId: null,
			missions: [],
		};
		const deletedSnapshot = {
			activeMissionId: null,
			missions: [
				{
					createdAt: "2026-05-25T00:00:00.000Z",
					id: "mission-1",
					lastError: null,
					sessionName: null,
					status: "draft",
					title: "Mission 1",
					updatedAt: "2026-05-25T00:00:00.000Z",
					workspaceRoot: null,
				},
			],
		};
		const missionsStore = {
			getSnapshot: vi.fn().mockReturnValue(initialSnapshot),
		};
		const provider = new Ff15MissionsViewProvider(
			{} as never,
			missionsStore as never,
			{
				missionSessionController: {
					createMission: vi.fn(),
					deleteMission: vi.fn(),
					onDidChangeMissionSnapshot: vi.fn((listener) => {
						missionSnapshotListener = listener;
						return { dispose: vi.fn() };
					}),
					selectMission: vi.fn(),
				} as never,
			}
		);
		const webviewView = {
			webview: {
				html: "",
				localResourceRoots: [],
				options: undefined,
				postMessage: vi.fn(),
				onDidReceiveMessage: vi.fn((listener) => {
					messageHandler = listener;
					return { dispose: vi.fn() };
				}),
			},
		};

		provider.resolveWebviewView(webviewView as never, {} as never, {} as never);

		expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(1, {
			command: "ff15-missions.state",
			devMode: false,
			snapshot: initialSnapshot,
		});

		missionSnapshotListener?.(deletedSnapshot);

		expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(2, {
			command: "ff15-missions.state",
			devMode: false,
			snapshot: deletedSnapshot,
		});
	});

	it("submits prompts through the mission send controller", async () => {
		const emptySnapshot = {
			activeMissionId: "mission-1",
			missions: [
				{
					createdAt: "2026-05-25T00:00:00.000Z",
					id: "mission-1",
					lastError: null,
					sessionName: null,
					status: "draft",
					title: "Mission 1",
					updatedAt: "2026-05-25T00:00:00.000Z",
					workspaceRoot: null,
				},
			],
		};
		const sentSnapshot = {
			activeMissionId: "mission-1",
			missions: [
				{
					createdAt: "2026-05-25T00:00:00.000Z",
					id: "mission-1",
					lastError: null,
					sessionName: "ff15-session",
					status: "active",
					title: "Mission 1",
					updatedAt: "2026-05-25T00:01:00.000Z",
					workspaceRoot: "C:/repo",
				},
			],
		};
		const missionsStore = {
			getSnapshot: vi.fn().mockReturnValue(emptySnapshot),
		};
		const missionSendController = {
			submitPrompt: vi.fn().mockResolvedValue(sentSnapshot),
		};
		const provider = new Ff15MissionsViewProvider(
			{} as never,
			missionsStore as never,
			{
				missionSendController: missionSendController as never,
			}
		);
		const webviewView = {
			webview: {
				html: "",
				localResourceRoots: [],
				options: undefined,
				postMessage: vi.fn(),
				onDidReceiveMessage: vi.fn((listener) => {
					messageHandler = listener;
					return { dispose: vi.fn() };
				}),
			},
		};

		provider.resolveWebviewView(webviewView as never, {} as never, {} as never);

		await messageHandler?.({
			command: "ff15-missions.send",
			missionId: "mission-1",
			prompt: "Investigate the regression",
		});

		expect(missionSendController.submitPrompt).toHaveBeenCalledWith({
			missionId: "mission-1",
			prompt: "Investigate the regression",
		});
		expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(2, {
			command: "ff15-missions.state",
			devMode: false,
			snapshot: sentSnapshot,
		});
	});

	it("retries prompts through the mission send controller", async () => {
		const emptySnapshot = {
			activeMissionId: "mission-1",
			missions: [
				{
					createdAt: "2026-05-25T00:00:00.000Z",
					id: "mission-1",
					lastError:
						"FF15 could not resolve a live Noctis pane for this mission.",
					sessionName: "ff15-session",
					status: "error",
					title: "Mission 1",
					updatedAt: "2026-05-25T00:00:00.000Z",
					workspaceRoot: "C:/repo",
				},
			],
		};
		const retriedSnapshot = {
			activeMissionId: "mission-1",
			missions: [
				{
					createdAt: "2026-05-25T00:00:00.000Z",
					id: "mission-1",
					lastError: null,
					sessionName: "ff15-session",
					status: "active",
					title: "Mission 1",
					updatedAt: "2026-05-25T00:01:00.000Z",
					workspaceRoot: "C:/repo",
				},
			],
		};
		const missionsStore = {
			getSnapshot: vi.fn().mockReturnValue(emptySnapshot),
		};
		const missionSendController = {
			submitPrompt: vi.fn().mockResolvedValue(retriedSnapshot),
		};
		const provider = new Ff15MissionsViewProvider(
			{} as never,
			missionsStore as never,
			{
				missionSendController: missionSendController as never,
			}
		);
		const webviewView = {
			webview: {
				html: "",
				localResourceRoots: [],
				options: undefined,
				postMessage: vi.fn(),
				onDidReceiveMessage: vi.fn((listener) => {
					messageHandler = listener;
					return { dispose: vi.fn() };
				}),
			},
		};

		provider.resolveWebviewView(webviewView as never, {} as never, {} as never);

		await messageHandler?.({
			command: "ff15-missions.retry",
			missionId: "mission-1",
			prompt: "Retry the delivery",
		});

		expect(missionSendController.submitPrompt).toHaveBeenCalledWith({
			missionId: "mission-1",
			prompt: "Retry the delivery",
		});
		expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(2, {
			command: "ff15-missions.state",
			devMode: false,
			snapshot: retriedSnapshot,
		});
	});
});
