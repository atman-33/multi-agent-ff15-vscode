import { beforeEach, describe, expect, it, vi } from "vitest";
import { Ff15ProjectsViewProvider } from "./provider";

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
			sourceKind: "agents",
			sourcePath: "C:/workspace/.agents/harness",
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
			snapshot: resolverSnapshot,
		});

		await messageHandler?.({ command: "ff15-projects.ready" });

		expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(2, {
			command: "ff15-projects.state",
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
			sourceKind: "agents",
			sourcePath: "C:/workspace/.agents/harness",
			status: "ready",
		} as const;
		const showProjectsEditor = vi.fn().mockResolvedValue(undefined);
		const provider = new Ff15ProjectsViewProvider({} as never, {
			getWorkspaceRoot: () => "C:/workspace",
			projectsWorkbenchController: {
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
			snapshot: expect.objectContaining({
				error: expect.stringContaining("workspace root"),
				profiles: [],
				status: "error",
			}),
		});
	});
});
