import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewColumn } from "vscode";
import {
	createFf15ProjectsWorkbenchController,
	FF15_PROJECTS_WORKBENCH_PANEL_VIEW_TYPE,
} from "./workbench-controller";

vi.mock("vscode", () => ({
	ViewColumn: {
		Active: 1,
	},
}));

const createPanelDouble = () => {
	let disposeHandler: (() => void) | undefined;

	return {
		panel: {
			dispose: vi.fn(() => {
				disposeHandler?.();
			}),
			onDidDispose: vi.fn((handler: () => void) => {
				disposeHandler = handler;
				return { dispose: vi.fn() };
			}),
			reveal: vi.fn(),
			title: "",
			webview: {
				html: "",
				onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
				postMessage: vi.fn(),
			},
		},
	};
};

const createReadySnapshot = (overrides: Record<string, unknown> = {}) =>
	({
		activeProjects: ["project-a"],
		languageName: "en",
		error: null,
		openspec: {
			path: "C:/workspace/project-a/openspec",
			sourceProjectId: "project-a",
		},
		profiles: [
			{ id: "project-a", warnings: [] },
			{ id: "project-b", warnings: [] },
		],
		sourceKind: "ff15",
		sourcePath: "C:/workspace/.ff15",
		bootstrapped: false,
		status: "ready",
		...overrides,
	}) as const;

const getMessageHandler = (panelDouble: ReturnType<typeof createPanelDouble>) =>
	panelDouble.panel.webview.onDidReceiveMessage.mock.calls[0]?.[0] as
		| ((message: {
				command: string;
				draft?: unknown;
				resolution?: "discard-local" | "keep-local" | "reload";
		  }) => Promise<void>)
		| undefined;

const createWatcherDouble = () => {
	let onChange: (() => void | Promise<void>) | undefined;

	return {
		trigger: async () => {
			await onChange?.();
		},
		watchProjectsContext: vi.fn(
			(input: { onChange: () => void | Promise<void> }) => {
				onChange = input.onChange;
				return { dispose: vi.fn() };
			}
		),
	};
};

afterEach(() => {
	vi.useRealTimers();
});

describe("createFf15ProjectsWorkbenchController", () => {
	it("creates and reuses the Projects editor panel", async () => {
		const panelDouble = createPanelDouble();
		const createWebviewPanel = vi.fn().mockReturnValue(panelDouble.panel);
		const snapshot = createReadySnapshot();
		const controller = createFf15ProjectsWorkbenchController({
			createWebviewPanel,
			extensionUri: { fsPath: "C:/extension" } as never,
			renderWebviewContent: vi
				.fn()
				.mockReturnValue(
					'<div id="root" data-page="ff15-projects-workbench"></div>'
				),
			resolveProjectsContext: vi.fn().mockReturnValue(snapshot),
			watchProjectsContext: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		});

		await controller.showProjectsEditor("C:/workspace");
		await controller.showProjectsEditor("C:/workspace");

		expect(createWebviewPanel).toHaveBeenCalledTimes(1);
		expect(createWebviewPanel).toHaveBeenCalledWith(
			FF15_PROJECTS_WORKBENCH_PANEL_VIEW_TYPE,
			"Projects",
			ViewColumn.Active,
			expect.objectContaining({
				enableScripts: true,
				retainContextWhenHidden: true,
			})
		);
		expect(panelDouble.panel.webview.html).toContain(
			'data-page="ff15-projects-workbench"'
		);
		expect(panelDouble.panel.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-projects-workbench.state",
			devMode: false,
			snapshot,
		});
		expect(panelDouble.panel.reveal).toHaveBeenCalledWith(
			ViewColumn.Active,
			false
		);
	});

	it("debounces draft updates and saves the latest Projects editor draft", async () => {
		vi.useFakeTimers();

		const panelDouble = createPanelDouble();
		const initialSnapshot = createReadySnapshot();
		const savedSnapshot = createReadySnapshot({
			activeProjects: ["project-b"],
			openspec: {
				path: "C:/workspace/project-b/openspec",
				sourceProjectId: "project-b",
			},
		});
		const resolveProjectsContext = vi.fn().mockReturnValue(initialSnapshot);
		const saveProjectsContext = vi.fn().mockReturnValue(savedSnapshot);
		const watcherDouble = createWatcherDouble();
		const controller = createFf15ProjectsWorkbenchController({
			createWebviewPanel: vi.fn().mockReturnValue(panelDouble.panel),
			extensionUri: { fsPath: "C:/extension" } as never,
			renderWebviewContent: vi
				.fn()
				.mockReturnValue(
					'<div id="root" data-page="ff15-projects-workbench"></div>'
				),
			resolveProjectsContext,
			saveProjectsContext,
			watchProjectsContext: watcherDouble.watchProjectsContext,
		});
		const onDidChangeProjectsContext = vi.fn();
		controller.onDidChangeProjectsContext(onDidChangeProjectsContext);

		await controller.showProjectsEditor("C:/workspace");

		const onDidReceiveMessage = getMessageHandler(panelDouble);

		await onDidReceiveMessage?.({
			command: "ff15-projects-workbench.updateDraft",
			draft: {
				activeProjects: ["project-a"],
				openspec: { projectId: "project-a" },
			},
		});
		await onDidReceiveMessage?.({
			command: "ff15-projects-workbench.updateDraft",
			draft: {
				activeProjects: ["project-b"],
				openspec: { projectId: "project-b" },
			},
		});

		await vi.advanceTimersByTimeAsync(399);

		expect(saveProjectsContext).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);

		expect(saveProjectsContext).toHaveBeenCalledWith({
			draft: {
				activeProjects: ["project-b"],
				openspec: { projectId: "project-b" },
			},
			workspaceRoot: "C:/workspace",
		});
		expect(panelDouble.panel.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-projects-workbench.state",
			devMode: false,
			snapshot: savedSnapshot,
		});
		expect(panelDouble.panel.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-projects-workbench.save-status",
			message: "Projects saved.",
			state: "saved",
		});
		expect(onDidChangeProjectsContext).toHaveBeenCalledTimes(2);
	});

	it("auto-refreshes the Projects editor when watched files change and no draft is pending", async () => {
		const panelDouble = createPanelDouble();
		const initialSnapshot = createReadySnapshot();
		const externalSnapshot = createReadySnapshot({
			activeProjects: ["project-b"],
			openspec: {
				path: "C:/workspace/project-b/openspec",
				sourceProjectId: "project-b",
			},
		});
		const resolveProjectsContext = vi
			.fn()
			.mockReturnValueOnce(initialSnapshot)
			.mockReturnValue(externalSnapshot);
		const watcherDouble = createWatcherDouble();
		const controller = createFf15ProjectsWorkbenchController({
			createWebviewPanel: vi.fn().mockReturnValue(panelDouble.panel),
			extensionUri: { fsPath: "C:/extension" } as never,
			renderWebviewContent: vi
				.fn()
				.mockReturnValue(
					'<div id="root" data-page="ff15-projects-workbench"></div>'
				),
			resolveProjectsContext,
			watchProjectsContext: watcherDouble.watchProjectsContext,
		});

		await controller.showProjectsEditor("C:/workspace");
		await watcherDouble.trigger();

		expect(panelDouble.panel.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-projects-workbench.state",
			devMode: false,
			snapshot: externalSnapshot,
		});
		expect(panelDouble.panel.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-projects-workbench.save-status",
			message: "Projects reloaded from external changes.",
			state: "saved",
		});
	});

	it("reloads the queued external snapshot after a conflict", async () => {
		vi.useFakeTimers();

		const panelDouble = createPanelDouble();
		const initialSnapshot = createReadySnapshot();
		const externalSnapshot = createReadySnapshot({
			activeProjects: ["project-b"],
			openspec: {
				path: "C:/workspace/project-b/openspec",
				sourceProjectId: "project-b",
			},
		});
		const resolveProjectsContext = vi
			.fn()
			.mockReturnValueOnce(initialSnapshot)
			.mockReturnValue(externalSnapshot);
		const saveProjectsContext = vi.fn();
		const watcherDouble = createWatcherDouble();
		const controller = createFf15ProjectsWorkbenchController({
			createWebviewPanel: vi.fn().mockReturnValue(panelDouble.panel),
			extensionUri: { fsPath: "C:/extension" } as never,
			renderWebviewContent: vi
				.fn()
				.mockReturnValue(
					'<div id="root" data-page="ff15-projects-workbench"></div>'
				),
			resolveProjectsContext,
			saveProjectsContext,
			watchProjectsContext: watcherDouble.watchProjectsContext,
		});

		await controller.showProjectsEditor("C:/workspace");
		const onDidReceiveMessage = getMessageHandler(panelDouble);
		await onDidReceiveMessage?.({
			command: "ff15-projects-workbench.updateDraft",
			draft: {
				activeProjects: ["project-b"],
				openspec: { projectId: "project-b" },
			},
		});

		await watcherDouble.trigger();
		await vi.advanceTimersByTimeAsync(400);

		expect(saveProjectsContext).not.toHaveBeenCalled();
		expect(panelDouble.panel.webview.postMessage).toHaveBeenCalledWith({
			active: true,
			command: "ff15-projects-workbench.conflict",
			message:
				"External Projects changes detected. Choose how to resolve them before applying the new state.",
		});

		await onDidReceiveMessage?.({
			command: "ff15-projects-workbench.resolveConflict",
			resolution: "reload",
		});

		expect(panelDouble.panel.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-projects-workbench.state",
			devMode: false,
			snapshot: externalSnapshot,
		});
	});

	it("discards the local draft and restores the last accepted snapshot without applying the queued external state", async () => {
		vi.useFakeTimers();

		const panelDouble = createPanelDouble();
		const initialSnapshot = createReadySnapshot();
		const externalSnapshot = createReadySnapshot({
			activeProjects: ["project-b"],
			openspec: {
				path: "C:/workspace/project-b/openspec",
				sourceProjectId: "project-b",
			},
		});
		const resolveProjectsContext = vi
			.fn()
			.mockReturnValueOnce(initialSnapshot)
			.mockReturnValue(externalSnapshot);
		const saveProjectsContext = vi.fn();
		const watcherDouble = createWatcherDouble();
		const controller = createFf15ProjectsWorkbenchController({
			createWebviewPanel: vi.fn().mockReturnValue(panelDouble.panel),
			extensionUri: { fsPath: "C:/extension" } as never,
			renderWebviewContent: vi
				.fn()
				.mockReturnValue(
					'<div id="root" data-page="ff15-projects-workbench"></div>'
				),
			resolveProjectsContext,
			saveProjectsContext,
			watchProjectsContext: watcherDouble.watchProjectsContext,
		});

		await controller.showProjectsEditor("C:/workspace");
		const onDidReceiveMessage = getMessageHandler(panelDouble);
		await onDidReceiveMessage?.({
			command: "ff15-projects-workbench.updateDraft",
			draft: {
				activeProjects: ["project-b"],
				openspec: { projectId: "project-b" },
			},
		});

		await watcherDouble.trigger();
		await onDidReceiveMessage?.({
			command: "ff15-projects-workbench.resolveConflict",
			resolution: "discard-local",
		});

		expect(saveProjectsContext).not.toHaveBeenCalled();
		expect(panelDouble.panel.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-projects-workbench.state",
			devMode: false,
			snapshot: initialSnapshot,
		});
		expect(panelDouble.panel.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-projects-workbench.save-status",
			message: "Local Projects edits discarded.",
			state: "saved",
		});
	});

	it("keeps the local draft only after an explicit keep-local choice and then resumes save", async () => {
		vi.useFakeTimers();

		const panelDouble = createPanelDouble();
		const initialSnapshot = createReadySnapshot();
		const externalSnapshot = createReadySnapshot({
			activeProjects: ["project-b"],
			openspec: {
				path: "C:/workspace/project-b/openspec",
				sourceProjectId: "project-b",
			},
		});
		const savedSnapshot = createReadySnapshot({
			activeProjects: ["project-c"],
			openspec: {
				path: "C:/workspace/project-c/openspec",
				sourceProjectId: "project-c",
			},
			profiles: [
				{ id: "project-a", warnings: [] },
				{ id: "project-b", warnings: [] },
				{ id: "project-c", warnings: [] },
			],
		});
		const resolveProjectsContext = vi
			.fn()
			.mockReturnValueOnce(initialSnapshot)
			.mockReturnValue(externalSnapshot);
		const saveProjectsContext = vi.fn().mockReturnValue(savedSnapshot);
		const watcherDouble = createWatcherDouble();
		const controller = createFf15ProjectsWorkbenchController({
			createWebviewPanel: vi.fn().mockReturnValue(panelDouble.panel),
			extensionUri: { fsPath: "C:/extension" } as never,
			renderWebviewContent: vi
				.fn()
				.mockReturnValue(
					'<div id="root" data-page="ff15-projects-workbench"></div>'
				),
			resolveProjectsContext,
			saveProjectsContext,
			watchProjectsContext: watcherDouble.watchProjectsContext,
		});

		await controller.showProjectsEditor("C:/workspace");
		const onDidReceiveMessage = getMessageHandler(panelDouble);
		const localDraft = {
			activeProjects: ["project-c"],
			openspec: { projectId: "project-c" },
		} as const;
		await onDidReceiveMessage?.({
			command: "ff15-projects-workbench.updateDraft",
			draft: localDraft,
		});

		await watcherDouble.trigger();
		await vi.advanceTimersByTimeAsync(400);

		expect(saveProjectsContext).not.toHaveBeenCalled();

		await onDidReceiveMessage?.({
			command: "ff15-projects-workbench.resolveConflict",
			resolution: "keep-local",
		});
		await vi.advanceTimersByTimeAsync(400);

		expect(saveProjectsContext).toHaveBeenCalledWith({
			draft: localDraft,
			workspaceRoot: "C:/workspace",
		});
		expect(panelDouble.panel.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-projects-workbench.state",
			devMode: false,
			snapshot: savedSnapshot,
		});
	});
});
