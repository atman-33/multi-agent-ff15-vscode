import { beforeEach, describe, expect, it, vi } from "vitest";
import { window } from "vscode";
import { Ff15ProjectsViewProvider } from "./provider";

const createWebviewViewDouble = (
	onListener: (listener: (message: { command?: string }) => void) => void
) => ({
	webview: {
		html: "",
		localResourceRoots: [],
		options: undefined,
		postMessage: vi.fn(),
		onDidReceiveMessage: vi.fn((listener) => {
			onListener(listener);
			return { dispose: vi.fn() };
		}),
	},
});

vi.mock("../../lib/webview/get-webview-content", () => ({
	getWebviewContent: vi
		.fn()
		.mockReturnValue('<div id="root" data-page="ff15-projects"></div>'),
}));

describe("Ff15ProjectsViewProvider", () => {
	let messageHandler:
		| ((message: { command?: string }) => void | Promise<void>)
		| undefined;

	beforeEach(() => {
		messageHandler = undefined;
	});

	it("renders the Projects page and posts resolved projects context", async () => {
		const resolverSnapshot = {
			activeProjects: ["project-a"],
			configVersion: 3,
			error: null,
			openspec: {
				mode: "project",
				path: "C:/workspace/openspec",
				sourceProjectId: "project-a",
			},
			profiles: [{ id: "project-a", warnings: [] }],
			sourceKind: "ff15",
			sourcePath: "C:/workspace/.ff15/harness",
			bootstrapped: false,
			status: "ready",
		} as const;
		const resolveProjectsContext = vi.fn().mockReturnValue(resolverSnapshot);
		const getWorkspaceRoot = vi.fn(() => "C:/workspace");
		const provider = new Ff15ProjectsViewProvider({} as never, {
			getWorkspaceRoot,
			resolveProjectsContext,
		});
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

		expect(webviewView.webview.html).toContain('data-page="ff15-projects"');
		expect(getWorkspaceRoot).toHaveBeenCalledTimes(1);
		expect(resolveProjectsContext).toHaveBeenCalledWith({
			workspaceRoot: "C:/workspace",
		});
		expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(1, {
			command: "ff15-projects.state",
			devMode: false,
			snapshot: resolverSnapshot,
		});

		await messageHandler?.({ command: "ff15-projects.ready" });

		expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(2, {
			command: "ff15-projects.state",
			devMode: false,
			snapshot: resolverSnapshot,
		});
	});

	it("opens the Projects editor in a central panel from the sidebar action", async () => {
		const resolverSnapshot = {
			activeProjects: ["project-a"],
			configVersion: 3,
			error: null,
			openspec: {
				mode: "project",
				path: "C:/workspace/openspec",
				sourceProjectId: "project-a",
			},
			profiles: [{ id: "project-a", warnings: [] }],
			sourceKind: "ff15",
			sourcePath: "C:/workspace/.ff15/harness",
			bootstrapped: false,
			status: "ready",
		} as const;
		const showProjectsEditor = vi.fn().mockResolvedValue(undefined);
		const provider = new Ff15ProjectsViewProvider({} as never, {
			getWorkspaceRoot: () => "C:/workspace",
			projectsWorkbenchController: {
				onDidChangeProjectsContext: vi.fn(() => ({ dispose: vi.fn() })),
				showProjectsEditor,
			},
			resolveProjectsContext: vi.fn().mockReturnValue(resolverSnapshot),
		});
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

		await messageHandler?.({ command: "ff15-projects.open-editor" });

		expect(showProjectsEditor).toHaveBeenCalledWith("C:/workspace");
	});

	it("refreshes the sidebar snapshot when the Projects editor controller reports a saved change", () => {
		const initialSnapshot = {
			activeProjects: ["project-a"],
			configVersion: 3,
			error: null,
			openspec: {
				mode: "project",
				path: "C:/workspace/openspec-a",
				sourceProjectId: "project-a",
			},
			profiles: [{ id: "project-a", warnings: [] }],
			sourceKind: "ff15",
			sourcePath: "C:/workspace/.ff15/harness",
			bootstrapped: false,
			status: "ready",
		} as const;
		const updatedSnapshot = {
			...initialSnapshot,
			activeProjects: ["project-b"],
			openspec: {
				mode: "project",
				path: "C:/workspace/openspec-b",
				sourceProjectId: "project-b",
			},
			profiles: [{ id: "project-b", warnings: [] }],
		} as const;
		let controllerListener: (() => void) | undefined;
		const resolveProjectsContext = vi
			.fn()
			.mockReturnValueOnce(initialSnapshot)
			.mockReturnValue(updatedSnapshot);
		const provider = new Ff15ProjectsViewProvider({} as never, {
			getWorkspaceRoot: () => "C:/workspace",
			projectsWorkbenchController: {
				onDidChangeProjectsContext: vi.fn((listener) => {
					controllerListener = listener;
					return { dispose: vi.fn() };
				}),
				showProjectsEditor: vi.fn().mockResolvedValue(undefined),
			},
			resolveProjectsContext,
		});
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
			command: "ff15-projects.state",
			devMode: false,
			snapshot: initialSnapshot,
		});

		controllerListener?.();

		expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(2, {
			command: "ff15-projects.state",
			devMode: false,
			snapshot: updatedSnapshot,
		});
	});

	it("posts an explicit error snapshot when workspace root is unavailable", () => {
		const resolveProjectsContext = vi.fn();
		const provider = new Ff15ProjectsViewProvider({} as never, {
			getWorkspaceRoot: () => {
				return;
			},
			resolveProjectsContext,
		});
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

		expect(resolveProjectsContext).not.toHaveBeenCalled();
		expect(webviewView.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-projects.state",
			devMode: false,
			snapshot: expect.objectContaining({
				error: expect.stringContaining("workspace root"),
				profiles: [],
				status: "error",
			}),
		});
	});

	it("notifies once when default config was bootstrapped", async () => {
		const infoSpy = vi
			.spyOn(window, "showInformationMessage")
			.mockResolvedValue(undefined);
		const snapshot = {
			activeProjects: ["default"],
			configVersion: 3,
			error: null,
			openspec: {
				mode: "project",
				path: "C:/workspace/openspec",
				sourceProjectId: "default",
			},
			profiles: [{ id: "default", warnings: [] }],
			sourceKind: "ff15",
			sourcePath: "C:/workspace/.ff15/harness",
			bootstrapped: true,
			status: "ready",
		} as const;
		const provider = new Ff15ProjectsViewProvider({} as never, {
			getWorkspaceRoot: () => "C:/workspace",
			resolveProjectsContext: vi.fn().mockReturnValue(snapshot),
		});
		const webviewView = createWebviewViewDouble((listener) => {
			messageHandler = listener;
		});

		provider.resolveWebviewView(webviewView as never, {} as never, {} as never);
		// A second post (e.g. webview ready) must not re-notify.
		await messageHandler?.({ command: "ff15-projects.ready" });

		expect(infoSpy).toHaveBeenCalledTimes(1);
		infoSpy.mockRestore();
	});

	it("does not notify when config already exists", () => {
		const infoSpy = vi
			.spyOn(window, "showInformationMessage")
			.mockResolvedValue(undefined);
		const snapshot = {
			activeProjects: ["default"],
			configVersion: 3,
			error: null,
			openspec: {
				mode: "project",
				path: "C:/workspace/openspec",
				sourceProjectId: "default",
			},
			profiles: [{ id: "default", warnings: [] }],
			sourceKind: "ff15",
			sourcePath: "C:/workspace/.ff15/harness",
			bootstrapped: false,
			status: "ready",
		} as const;
		const provider = new Ff15ProjectsViewProvider({} as never, {
			getWorkspaceRoot: () => "C:/workspace",
			resolveProjectsContext: vi.fn().mockReturnValue(snapshot),
		});
		const webviewView = createWebviewViewDouble((listener) => {
			messageHandler = listener;
		});

		provider.resolveWebviewView(webviewView as never, {} as never, {} as never);

		expect(infoSpy).not.toHaveBeenCalled();
		infoSpy.mockRestore();
	});
});
