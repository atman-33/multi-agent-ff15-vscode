import { describe, expect, it, vi } from "vitest";

const { missionsViewProviderConstructor } = vi.hoisted(() => ({
	missionsViewProviderConstructor: vi.fn(),
}));

vi.mock("vscode", () => ({
	commands: {
		registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
	},
	workspace: {
		getConfiguration: vi.fn(() => ({ get: vi.fn() })),
		getWorkspaceFolder: vi.fn(),
		workspaceFolders: undefined,
	},
	window: {
		activeTextEditor: undefined,
		registerWebviewViewProvider: vi.fn(() => ({ dispose: vi.fn() })),
	},
}));

vi.mock("./features/ff15-launch/provider", () => ({
	Ff15LaunchViewProvider: class {
		static readonly viewId = "multi-agent-ff15-vscode.launchView";
	},
}));

vi.mock("./features/ff15-missions/provider", () => ({
	Ff15MissionsViewProvider: class {
		static readonly viewId = "multi-agent-ff15-vscode.missionsView";

		constructor(...args: unknown[]) {
			missionsViewProviderConstructor(...args);
		}
	},
}));

vi.mock("./features/ff15-settings/provider", () => ({
	Ff15SettingsViewProvider: class {
		static readonly viewId = "multi-agent-ff15-vscode.settingsView";
	},
}));

import { commands, window } from "vscode";
import { activate } from "./extension";

describe("activate", () => {
	it("registers the FF15 launch, missions, settings views, and settings command", () => {
		const context = {
			extensionUri: {},
			subscriptions: [] as Array<{ dispose: () => void }>,
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(() => Promise.resolve()),
			},
		};

		activate(context as never);

		expect(missionsViewProviderConstructor).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({
				missionSendController: expect.anything(),
				missionSessionController: expect.anything(),
				missionWorkbenchController: expect.objectContaining({
					showMission: expect.any(Function),
				}),
			})
		);

		expect(window.registerWebviewViewProvider).toHaveBeenNthCalledWith(
			1,
			"multi-agent-ff15-vscode.launchView",
			expect.anything()
		);
		expect(window.registerWebviewViewProvider).toHaveBeenNthCalledWith(
			2,
			"multi-agent-ff15-vscode.missionsView",
			expect.anything()
		);
		expect(window.registerWebviewViewProvider).toHaveBeenNthCalledWith(
			3,
			"multi-agent-ff15-vscode.settingsView",
			expect.anything()
		);
		expect(commands.registerCommand).toHaveBeenCalledWith(
			"multi-agent-ff15-vscode.openSettings",
			expect.any(Function)
		);
		expect(context.subscriptions).toHaveLength(4);
	});
});
