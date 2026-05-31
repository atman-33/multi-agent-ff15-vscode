import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	Ff15ProjectsContextReadySnapshot,
	Ff15ProjectsContextSnapshot,
} from "./context-resolver";
import { Ff15ProjectsViewProvider } from "./provider";

vi.mock("../../lib/webview/get-webview-content", () => ({
	getWebviewContent: vi
		.fn()
		.mockReturnValue('<div id="root" data-page="ff15-projects"></div>'),
}));

const cloneReadySnapshot = (
	snapshot: Ff15ProjectsContextReadySnapshot
): Ff15ProjectsContextReadySnapshot => ({
	...snapshot,
	activeProjects: [...snapshot.activeProjects],
	openspec: { ...snapshot.openspec },
	profiles: snapshot.profiles.map((profile) => ({
		...profile,
		warnings: [...profile.warnings],
	})),
});

describe("Ff15ProjectsViewProvider", () => {
	let messageHandler:
		| ((message: { command?: string; draft?: unknown }) => void | Promise<void>)
		| undefined;

	beforeEach(() => {
		messageHandler = undefined;
	});

	afterEach(() => {
		vi.useRealTimers();
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

	it("debounces draft updates and saves the latest projects draft", async () => {
		vi.useFakeTimers();

		const initialSnapshot: Ff15ProjectsContextReadySnapshot = {
			activeProjects: ["project-a"],
			configVersion: 3,
			error: null,
			openspec: {
				mode: "project",
				path: "C:/workspace/project-a/openspec",
				sourceProjectId: "project-a",
			},
			profiles: [
				{ id: "project-a", warnings: [] },
				{ id: "project-b", warnings: [] },
			],
			sourceKind: "agents",
			sourcePath: "C:/workspace/.agents/harness",
			status: "ready",
		};
		const savedSnapshot: Ff15ProjectsContextReadySnapshot = {
			...initialSnapshot,
			activeProjects: ["project-b"],
			openspec: {
				mode: "project",
				path: "C:/workspace/project-b/openspec",
				sourceProjectId: "project-b",
			},
		};
		const saveProjectsContext = vi.fn().mockReturnValue(savedSnapshot);
		const resolveProjectsContext = (_input: {
			workspaceRoot: string;
		}): Ff15ProjectsContextSnapshot => cloneReadySnapshot(initialSnapshot);
		const provider = new Ff15ProjectsViewProvider({} as never, {
			getWorkspaceRoot: () => "C:/workspace",
			resolveProjectsContext,
			saveProjectsContext,
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

		await messageHandler?.({
			command: "ff15-projects.updateDraft",
			draft: {
				activeProjects: ["project-a"],
				openspec: { mode: "project", projectId: "project-a" },
			},
		});
		await messageHandler?.({
			command: "ff15-projects.updateDraft",
			draft: {
				activeProjects: ["project-b"],
				openspec: { mode: "project", projectId: "project-b" },
			},
		});

		await vi.advanceTimersByTimeAsync(399);

		expect(saveProjectsContext).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);

		expect(saveProjectsContext).toHaveBeenCalledTimes(1);
		expect(saveProjectsContext).toHaveBeenCalledWith({
			draft: {
				activeProjects: ["project-b"],
				openspec: { mode: "project", projectId: "project-b" },
			},
			workspaceRoot: "C:/workspace",
		});
		expect(webviewView.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-projects.state",
			snapshot: savedSnapshot,
		});
	});

	it("rolls back to the last valid snapshot when saving the draft fails", async () => {
		vi.useFakeTimers();

		const initialSnapshot: Ff15ProjectsContextReadySnapshot = {
			activeProjects: ["project-a"],
			configVersion: 3,
			error: null,
			openspec: {
				mode: "project",
				path: "C:/workspace/project-a/openspec",
				sourceProjectId: "project-a",
			},
			profiles: [
				{ id: "project-a", warnings: [] },
				{ id: "project-b", warnings: [] },
			],
			sourceKind: "agents",
			sourcePath: "C:/workspace/.agents/harness",
			status: "ready",
		};
		const saveProjectsContext = vi.fn(() => {
			throw new Error("Missing profile for openspec.project_id 'project-b'.");
		});
		const resolveProjectsContext = (_input: {
			workspaceRoot: string;
		}): Ff15ProjectsContextSnapshot => cloneReadySnapshot(initialSnapshot);
		const provider = new Ff15ProjectsViewProvider({} as never, {
			getWorkspaceRoot: () => "C:/workspace",
			resolveProjectsContext,
			saveProjectsContext,
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

		await messageHandler?.({
			command: "ff15-projects.updateDraft",
			draft: {
				activeProjects: ["project-b"],
				openspec: { mode: "project", projectId: "project-b" },
			},
		});

		await vi.advanceTimersByTimeAsync(400);

		expect(saveProjectsContext).toHaveBeenCalledTimes(1);
		expect(webviewView.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-projects.state",
			snapshot: initialSnapshot,
		});
		expect(webviewView.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-projects.save-status",
			message: "Missing profile for openspec.project_id 'project-b'.",
			state: "error",
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
			snapshot: expect.objectContaining({
				error: expect.stringContaining("workspace root"),
				profiles: [],
				status: "error",
			}),
		});
	});
});
