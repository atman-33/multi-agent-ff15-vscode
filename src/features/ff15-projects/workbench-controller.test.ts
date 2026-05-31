import { describe, expect, it, vi } from "vitest";
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

describe("createFf15ProjectsWorkbenchController", () => {
	it("creates and reuses the Projects editor panel", async () => {
		const panelDouble = createPanelDouble();
		const createWebviewPanel = vi.fn().mockReturnValue(panelDouble.panel);
		const snapshot = {
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
		} as const;
		const controller = createFf15ProjectsWorkbenchController({
			createWebviewPanel,
			extensionUri: { fsPath: "C:/extension" } as never,
			renderWebviewContent: vi
				.fn()
				.mockReturnValue(
					'<div id="root" data-page="ff15-projects-workbench"></div>'
				),
			resolveProjectsContext: vi.fn().mockReturnValue(snapshot),
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
		const initialSnapshot = {
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
		} as const;
		const savedSnapshot = {
			...initialSnapshot,
			activeProjects: ["project-b"],
			openspec: {
				mode: "project",
				path: "C:/workspace/project-b/openspec",
				sourceProjectId: "project-b",
			},
		} as const;
		const resolveProjectsContext = vi.fn().mockReturnValue(initialSnapshot);
		const saveProjectsContext = vi.fn().mockReturnValue(savedSnapshot);
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
		});

		await controller.showProjectsEditor("C:/workspace");

		const onDidReceiveMessage = panelDouble.panel.webview.onDidReceiveMessage
			.mock.calls[0]?.[0] as
			| ((message: { command: string; draft?: unknown }) => Promise<void>)
			| undefined;

		await onDidReceiveMessage?.({
			command: "ff15-projects-workbench.updateDraft",
			draft: {
				activeProjects: ["project-a"],
				openspec: { mode: "project", projectId: "project-a" },
			},
		});
		await onDidReceiveMessage?.({
			command: "ff15-projects-workbench.updateDraft",
			draft: {
				activeProjects: ["project-b"],
				openspec: { mode: "project", projectId: "project-b" },
			},
		});

		await vi.advanceTimersByTimeAsync(399);

		expect(saveProjectsContext).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);

		expect(saveProjectsContext).toHaveBeenCalledWith({
			draft: {
				activeProjects: ["project-b"],
				openspec: { mode: "project", projectId: "project-b" },
			},
			workspaceRoot: "C:/workspace",
		});
		expect(panelDouble.panel.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-projects-workbench.state",
			snapshot: savedSnapshot,
		});
		expect(panelDouble.panel.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-projects-workbench.save-status",
			message: "Projects saved.",
			state: "saved",
		});
	});
});
