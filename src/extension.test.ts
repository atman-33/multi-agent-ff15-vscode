import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
	commands: {
		registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
	},
	window: {
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
