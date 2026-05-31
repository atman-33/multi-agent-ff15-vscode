import type { Uri, Webview, WebviewPanel } from "vscode";
import { ViewColumn, window } from "vscode";
import { getWebviewContent } from "../../lib/webview/get-webview-content";
import {
	saveFf15ProjectsContext,
	type Ff15ProjectsContextDraft,
	type Ff15ProjectsContextSnapshot,
} from "./context-resolver";

export const FF15_PROJECTS_WORKBENCH_PANEL_VIEW_TYPE =
	"multi-agent-ff15-vscode.projectsWorkbench";

export interface Ff15ProjectsWorkbenchController {
	showProjectsEditor: (workspaceRoot: string) => Promise<void>;
}

interface CreateFf15ProjectsWorkbenchControllerOptions {
	createWebviewPanel?: typeof window.createWebviewPanel;
	extensionUri: Uri;
	renderWebviewContent?: (
		webview: Webview,
		extensionUri: Uri,
		page: string
	) => string;
	resolveProjectsContext: (input: {
		workspaceRoot: string;
	}) => Ff15ProjectsContextSnapshot;
	saveProjectsContext?: (input: {
		draft: Ff15ProjectsContextDraft;
		workspaceRoot: string;
	}) => Ff15ProjectsContextSnapshot;
}

const FF15_PROJECTS_WORKBENCH_PAGE_ID = "ff15-projects-workbench";
const FF15_PROJECTS_SAVE_DEBOUNCE_MS = 400;

export const createFf15ProjectsWorkbenchController = (
	options: CreateFf15ProjectsWorkbenchControllerOptions
): Ff15ProjectsWorkbenchController => {
	const createWebviewPanel =
		options.createWebviewPanel ?? window.createWebviewPanel;
	const renderWebviewContent =
		options.renderWebviewContent ?? getWebviewContent;
	const saveProjectsContext =
		options.saveProjectsContext ?? saveFf15ProjectsContext;
	let activeWorkspaceRoot: string | undefined;
	let panel: WebviewPanel | undefined;
	let pendingSaveTimer: ReturnType<typeof setTimeout> | undefined;

	const postState = async (
		workspaceRoot: string,
		targetPanel: WebviewPanel
	) => {
		await targetPanel.webview.postMessage({
			command: "ff15-projects-workbench.state",
			snapshot: options.resolveProjectsContext({ workspaceRoot }),
		});
	};

	const postSaveStatus = async (
		targetPanel: WebviewPanel,
		payload: {
			message: string;
			state: "error" | "saved" | "saving";
		}
	) => {
		await targetPanel.webview.postMessage({
			command: "ff15-projects-workbench.save-status",
			...payload,
		});
	};

	const scheduleSave = async (
		draft: Ff15ProjectsContextDraft,
		targetPanel: WebviewPanel
	) => {
		if (!activeWorkspaceRoot) {
			return;
		}

		if (pendingSaveTimer) {
			clearTimeout(pendingSaveTimer);
		}

		await postSaveStatus(targetPanel, {
			message: "Saving Projects...",
			state: "saving",
		});

		pendingSaveTimer = setTimeout(async () => {
			if (!activeWorkspaceRoot) {
				pendingSaveTimer = undefined;
				return;
			}

			try {
				const snapshot = saveProjectsContext({
					draft,
					workspaceRoot: activeWorkspaceRoot,
				});
				await targetPanel.webview.postMessage({
					command: "ff15-projects-workbench.state",
					snapshot,
				});
				await postSaveStatus(targetPanel, {
					message: "Projects saved.",
					state: "saved",
				});
			} catch (error) {
				await postSaveStatus(targetPanel, {
					message:
						error instanceof Error
							? error.message
							: "Failed to save Projects context.",
					state: "error",
				});
			} finally {
				pendingSaveTimer = undefined;
			}
		}, FF15_PROJECTS_SAVE_DEBOUNCE_MS);
	};

	const bindPanelMessages = (targetPanel: WebviewPanel) => {
		targetPanel.webview.onDidReceiveMessage(async (message) => {
			switch (message.command) {
				case "ff15-projects-workbench.ready": {
					if (activeWorkspaceRoot) {
						await postState(activeWorkspaceRoot, targetPanel);
					}
					return;
				}
				case "ff15-projects-workbench.updateDraft": {
					await scheduleSave(
						message.draft as Ff15ProjectsContextDraft,
						targetPanel
					);
					return;
				}
				default:
					return;
			}
		});
	};

	return {
		showProjectsEditor: async (workspaceRoot: string) => {
			activeWorkspaceRoot = workspaceRoot;

			if (panel) {
				await postState(workspaceRoot, panel);
				panel.reveal(ViewColumn.Active, false);
				return;
			}

			panel = createWebviewPanel(
				FF15_PROJECTS_WORKBENCH_PANEL_VIEW_TYPE,
				"Projects",
				ViewColumn.Active,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
				}
			);

			panel.title = "Projects";
			panel.webview.html = renderWebviewContent(
				panel.webview,
				options.extensionUri,
				FF15_PROJECTS_WORKBENCH_PAGE_ID
			);
			bindPanelMessages(panel);
			panel.onDidDispose(() => {
				panel = undefined;
				activeWorkspaceRoot = undefined;
			});

			await postState(workspaceRoot, panel);
		},
	};
};
