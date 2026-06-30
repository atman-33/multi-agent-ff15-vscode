import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	materializeBundledFf15WorkspaceTemplateFiles,
	missionsViewProviderConstructor,
	projectsViewProviderConstructor,
	projectsWorkbenchControllerFactory,
	resolveActiveWorkspaceRoot,
	opencodeViewProviderConstructor,
	serverManagerConstructor,
	serverManagerStart,
} = vi.hoisted(() => ({
	materializeBundledFf15WorkspaceTemplateFiles: vi.fn(),
	missionsViewProviderConstructor: vi.fn(),
	projectsViewProviderConstructor: vi.fn(),
	projectsWorkbenchControllerFactory: vi.fn(() => ({
		onDidChangeProjectsContext: vi.fn(() => ({ dispose: vi.fn() })),
		showProjectsEditor: vi.fn(),
	})),
	resolveActiveWorkspaceRoot: vi.fn(() => "c:/workspace"),
	opencodeViewProviderConstructor: vi.fn(),
	serverManagerConstructor: vi.fn(),
	serverManagerStart: vi.fn(),
}));

const createMockConfig = () => ({
	get: vi.fn((key: string, defaultValue?: unknown) => defaultValue),
});

vi.mock("vscode", () => ({
	commands: {
		registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
		executeCommand: vi.fn(() => Promise.resolve()),
	},
	ExtensionMode: {
		Development: 1,
		Production: 2,
		Test: 3,
	},
	Uri: {
		parse: vi.fn((value: string) => ({ toString: () => value })),
	},
	env: {
		asExternalUri: vi.fn((uri: unknown) => Promise.resolve(uri)),
	},
	workspace: {
		getConfiguration: vi.fn(() => createMockConfig()),
		getWorkspaceFolder: vi.fn(),
		workspaceFolders: undefined,
		asRelativePath: vi.fn((uri: { fsPath: string }) => uri.fsPath),
		onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
	},
	window: {
		activeTextEditor: undefined,
		registerWebviewViewProvider: vi.fn(() => ({ dispose: vi.fn() })),
		createOutputChannel: vi.fn(() => ({
			appendLine: vi.fn(),
			dispose: vi.fn(),
		})),
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(() => Promise.resolve(undefined)),
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

		constructor(...args: unknown[]) {
			projectsViewProviderConstructor(...args);
		}
	},
}));

vi.mock("./features/ff15-projects/workbench-controller", () => ({
	createFf15ProjectsWorkbenchController: projectsWorkbenchControllerFactory,
}));

vi.mock("./features/ff15-settings/provider", () => ({
	Ff15SettingsViewProvider: class {
		static readonly viewId = "multi-agent-ff15-vscode.settingsView";
	},
}));

vi.mock("./features/opencode-chat/opencode-view-provider", () => ({
	OpencodeViewProvider: class {
		isViewVisible = false;
		sidebarType: "primary" | "auxiliary" | null = null;

		constructor(...args: unknown[]) {
			opencodeViewProviderConstructor(...args);
		}

		setDevMode() {
			// no-op stub
		}
		setServerUrl() {
			// no-op stub
		}
		setLoading() {
			// no-op stub
		}
		setError() {
			// no-op stub
		}
		addToChat() {
			// no-op stub
		}
	},
}));

vi.mock("./features/opencode-chat/server-manager", () => ({
	ServerManager: class {
		constructor(...args: unknown[]) {
			serverManagerConstructor(...args);
		}

		start = serverManagerStart;
		dispose() {
			// no-op stub
		}
	},
}));

vi.mock("./features/opencode-chat/selection-reference", () => ({
	formatSelectionReference: vi.fn((relativePath: string) => relativePath),
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
			globalState: {
				get: vi.fn(),
				update: vi.fn(() => Promise.resolve()),
			},
			extensionMode: 2,
		};

		activate(context as never);

		// Activation must not scaffold the workspace; files are only written
		// through an explicit Initialize action.
		expect(materializeBundledFf15WorkspaceTemplateFiles).not.toHaveBeenCalled();

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
		expect(projectsWorkbenchControllerFactory).toHaveBeenCalledWith(
			expect.objectContaining({
				extensionUri: expect.anything(),
				resolveProjectsContext: expect.any(Function),
			})
		);
		expect(projectsViewProviderConstructor).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				initializeWorkspace: expect.any(Function),
				projectsWorkbenchController: expect.objectContaining({
					showProjectsEditor: expect.any(Function),
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
		expect(window.registerWebviewViewProvider).toHaveBeenNthCalledWith(
			4,
			"multi-agent-ff15-vscode.openCodeSidebar.chatView",
			expect.anything(),
			expect.objectContaining({
				webviewOptions: { retainContextWhenHidden: true },
			})
		);
		expect(commands.registerCommand).toHaveBeenCalledWith(
			"multi-agent-ff15-vscode.initializeWorkspace",
			expect.any(Function)
		);
		expect(commands.registerCommand).toHaveBeenCalledWith(
			"multi-agent-ff15-vscode.openSettings",
			expect.any(Function)
		);
		expect(commands.registerCommand).toHaveBeenCalledWith(
			"multi-agent-ff15-vscode.openCode.addToChat",
			expect.any(Function)
		);
		expect(commands.registerCommand).toHaveBeenCalledWith(
			"multi-agent-ff15-vscode.openCode.toggleChatView",
			expect.any(Function)
		);
		expect(commands.registerCommand).toHaveBeenCalledWith(
			"multi-agent-ff15-vscode.openCode.restart",
			expect.any(Function)
		);
		expect(commands.registerCommand).toHaveBeenCalledWith(
			"multi-agent-ff15-vscode.openCode.addSelectionToChat",
			expect.any(Function)
		);
		expect(serverManagerStart).toHaveBeenCalledWith(
			expect.anything(),
			context,
			expect.any(Number),
			expect.any(Number),
			expect.any(Boolean),
			expect.any(String)
		);
		expect(context.subscriptions.length).toBeGreaterThan(4);
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
			globalState: {
				get: vi.fn(),
				update: vi.fn(() => Promise.resolve()),
			},
			extensionMode: 2,
		};

		activate(context as never);

		expect(materializeBundledFf15WorkspaceTemplateFiles).not.toHaveBeenCalled();
	});
});
