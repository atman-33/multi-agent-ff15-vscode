import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	materializeBundledFf15WorkspaceTemplateFiles,
	missionsViewProviderConstructor,
	resolveActiveWorkspaceRoot,
} = vi.hoisted(() => ({
	materializeBundledFf15WorkspaceTemplateFiles: vi.fn(),
	missionsViewProviderConstructor: vi.fn(),
	resolveActiveWorkspaceRoot: vi.fn(() => "c:/workspace"),
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

vi.mock("./features/ff15-agents/materialize", () => ({
	materializeBundledFf15WorkspaceTemplateFiles,
}));

vi.mock("./features/ff15-launch/workspace-root", () => ({
	resolveActiveWorkspaceRoot,
}));

vi.mock("./features/ff15-missions/provider", () => ({
	Ff15MissionsViewProvider: class {
		static readonly viewId = "multi-agent-ff15-vscode.missionsView";

		constructor(...args: unknown[]) {
			missionsViewProviderConstructor(...args);
		}
	},
}));

vi.mock("./features/ff15-projects/provider", () => ({
	Ff15ProjectsViewProvider: class {
		static readonly viewId = "multi-agent-ff15-vscode.projectsView";
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
	beforeEach(() => {
		vi.clearAllMocks();
		resolveActiveWorkspaceRoot.mockReturnValue("c:/workspace");
	});

	it("registers the FF15 projects, missions, settings views, and settings command", () => {
		const context = {
			extensionUri: {
				fsPath: "c:/extension",
			},
			subscriptions: [] as Array<{ dispose: () => void }>,
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(() => Promise.resolve()),
			},
		};

		activate(context as never);

		expect(resolveActiveWorkspaceRoot).toHaveBeenCalled();
		expect(materializeBundledFf15WorkspaceTemplateFiles).toHaveBeenCalledWith({
			extensionRoot: "c:/extension",
			workspaceRoot: "c:/workspace",
		});

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
			"multi-agent-ff15-vscode.projectsView",
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

	it("skips workspace agent materialization when no workspace root is available", () => {
		resolveActiveWorkspaceRoot.mockReturnValueOnce(undefined);

		const context = {
			extensionUri: {
				fsPath: "c:/extension",
			},
			subscriptions: [] as Array<{ dispose: () => void }>,
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(() => Promise.resolve()),
			},
		};

		activate(context as never);

		expect(materializeBundledFf15WorkspaceTemplateFiles).not.toHaveBeenCalled();
	});
});
