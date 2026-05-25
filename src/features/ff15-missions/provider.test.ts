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
		  }) => void | Promise<void>)
		| undefined;

	beforeEach(() => {
		messageHandler = undefined;
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
			snapshot: {
				activeMissionId: null,
				missions: [],
			},
		});
	});

	it("creates and selects missions through the mission store", async () => {
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
		const missionsStore = {
			createMission: vi.fn().mockResolvedValue(createdSnapshot),
			getSnapshot: vi.fn().mockReturnValue(emptySnapshot),
			selectMission: vi.fn().mockResolvedValue(selectedSnapshot),
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

		await messageHandler?.({ command: "ff15-missions.create" });
		await messageHandler?.({
			command: "ff15-missions.select",
			missionId: "mission-2",
		});

		expect(missionsStore.createMission).toHaveBeenCalledTimes(1);
		expect(missionsStore.selectMission).toHaveBeenCalledWith("mission-2");
		expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(2, {
			command: "ff15-missions.state",
			snapshot: createdSnapshot,
		});
		expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(3, {
			command: "ff15-missions.state",
			snapshot: selectedSnapshot,
		});
	});
});
