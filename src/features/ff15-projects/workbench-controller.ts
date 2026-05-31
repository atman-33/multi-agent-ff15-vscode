import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import type { Disposable, Uri, Webview, WebviewPanel } from "vscode";
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
	onDidChangeProjectsContext: (listener: () => void) => Disposable;
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
	watchProjectsContext?: (input: {
		onChange: () => void | Promise<void>;
		sourcePath: string;
	}) => Disposable;
}

const FF15_PROJECTS_WORKBENCH_PAGE_ID = "ff15-projects-workbench";
const FF15_PROJECTS_SAVE_DEBOUNCE_MS = 400;

type Ff15ProjectsConflictResolution = "discard-local" | "keep-local" | "reload";
type Ff15ProjectsSaveState = "conflict" | "error" | "saved" | "saving";

const createProjectsContextWatcher = (input: {
	onChange: () => void | Promise<void>;
	sourcePath: string;
}): Disposable => {
	const watchers = [
		join(input.sourcePath, "config"),
		join(input.sourcePath, "projects"),
	]
		.filter((path) => existsSync(path))
		.map((path) =>
			watch(path, { persistent: false }, () => {
				input.onChange();
			})
		);

	return {
		dispose: () => {
			for (const watcher of watchers) {
				watcher.close();
			}
		},
	};
};

const getFallbackDraft = (): Ff15ProjectsContextDraft => ({
	activeProjects: [],
	openspec: {
		mode: "project",
		projectId: null,
	},
});

const buildDraftFromSnapshot = (
	snapshot: Ff15ProjectsContextSnapshot,
	previousDraft?: Ff15ProjectsContextDraft
): Ff15ProjectsContextDraft => {
	if (snapshot.status !== "ready") {
		return previousDraft ?? getFallbackDraft();
	}

	return {
		activeProjects: [...snapshot.activeProjects],
		openspec: {
			mode: snapshot.openspec.mode,
			projectId:
				snapshot.openspec.mode === "project"
					? snapshot.openspec.sourceProjectId
					: (previousDraft?.openspec.projectId ?? null),
		},
	};
};

const areDraftsEqual = (
	left: Ff15ProjectsContextDraft | undefined,
	right: Ff15ProjectsContextDraft | undefined
) => {
	if (!(left && right)) {
		return false;
	}

	return (
		left.openspec.mode === right.openspec.mode &&
		left.openspec.projectId === right.openspec.projectId &&
		left.activeProjects.length === right.activeProjects.length &&
		left.activeProjects.every(
			(projectId, index) => projectId === right.activeProjects[index]
		)
	);
};

export const createFf15ProjectsWorkbenchController = (
	options: CreateFf15ProjectsWorkbenchControllerOptions
): Ff15ProjectsWorkbenchController => {
	const createWebviewPanel =
		options.createWebviewPanel ?? window.createWebviewPanel;
	const renderWebviewContent =
		options.renderWebviewContent ?? getWebviewContent;
	const saveProjectsContext =
		options.saveProjectsContext ?? saveFf15ProjectsContext;
	const watchProjectsContext =
		options.watchProjectsContext ?? createProjectsContextWatcher;

	let activeWorkspaceRoot: string | undefined;
	let activeWatchSourcePath: string | undefined;
	let contextWatcher: Disposable | undefined;
	let lastAcceptedDraft: Ff15ProjectsContextDraft | undefined;
	let lastAcceptedSnapshot: Ff15ProjectsContextSnapshot | undefined;
	let latestDraft: Ff15ProjectsContextDraft | undefined;
	const projectsContextChangeListeners = new Set<() => void>();
	let panel: WebviewPanel | undefined;
	let pendingSaveTimer: ReturnType<typeof setTimeout> | undefined;
	let queuedExternalSnapshot: Ff15ProjectsContextSnapshot | undefined;

	const notifyProjectsContextChanged = () => {
		for (const listener of projectsContextChangeListeners) {
			listener();
		}
	};

	const clearPendingSave = () => {
		if (!pendingSaveTimer) {
			return;
		}

		clearTimeout(pendingSaveTimer);
		pendingSaveTimer = undefined;
	};

	const clearContextWatcher = () => {
		contextWatcher?.dispose();
		contextWatcher = undefined;
		activeWatchSourcePath = undefined;
	};

	const postConflict = async (
		targetPanel: WebviewPanel,
		payload: { active: boolean; message?: string }
	) => {
		await targetPanel.webview.postMessage({
			command: "ff15-projects-workbench.conflict",
			active: payload.active,
			message: payload.message ?? null,
		});
	};

	const postSaveStatus = async (
		targetPanel: WebviewPanel,
		payload: {
			message: string;
			state: Ff15ProjectsSaveState;
		}
	) => {
		await targetPanel.webview.postMessage({
			command: "ff15-projects-workbench.save-status",
			...payload,
		});
	};

	const applyAcceptedSnapshot = (
		snapshot: Ff15ProjectsContextSnapshot,
		draftOverride?: Ff15ProjectsContextDraft
	) => {
		lastAcceptedSnapshot = snapshot;
		lastAcceptedDraft = buildDraftFromSnapshot(
			snapshot,
			draftOverride ?? latestDraft
		);
		latestDraft = lastAcceptedDraft;
		queuedExternalSnapshot = undefined;
		notifyProjectsContextChanged();
	};

	const postAcceptedSnapshot = async (
		targetPanel: WebviewPanel,
		snapshot: Ff15ProjectsContextSnapshot,
		draftOverride?: Ff15ProjectsContextDraft
	) => {
		applyAcceptedSnapshot(snapshot, draftOverride);
		await targetPanel.webview.postMessage({
			command: "ff15-projects-workbench.state",
			snapshot,
		});
	};

	const resolveCurrentSnapshot = () => {
		if (!activeWorkspaceRoot) {
			return null;
		}

		return options.resolveProjectsContext({
			workspaceRoot: activeWorkspaceRoot,
		});
	};

	const handleExternalRefresh = async (
		targetPanel: WebviewPanel,
		externalSnapshot: Ff15ProjectsContextSnapshot
	) => {
		await postConflict(targetPanel, { active: false });
		await postAcceptedSnapshot(targetPanel, externalSnapshot);
		await postSaveStatus(targetPanel, {
			message: "Projects reloaded from external changes.",
			state: "saved",
		});
	};

	const handleExternalConflict = async (
		targetPanel: WebviewPanel,
		externalSnapshot: Ff15ProjectsContextSnapshot
	) => {
		clearPendingSave();
		queuedExternalSnapshot = externalSnapshot;
		await postConflict(targetPanel, {
			active: true,
			message:
				"External Projects changes detected. Choose how to resolve them before applying the new state.",
		});
		await postSaveStatus(targetPanel, {
			message:
				"External Projects changes detected. Resolve the conflict to continue.",
			state: "conflict",
		});
	};

	const handleExternalChange = async (targetPanel: WebviewPanel) => {
		const externalSnapshot = resolveCurrentSnapshot();
		if (!externalSnapshot) {
			return;
		}

		if (areDraftsEqual(latestDraft, lastAcceptedDraft)) {
			await handleExternalRefresh(targetPanel, externalSnapshot);
			return;
		}

		await handleExternalConflict(targetPanel, externalSnapshot);
	};

	const syncContextWatcher = (
		snapshot: Ff15ProjectsContextSnapshot,
		targetPanel: WebviewPanel
	) => {
		if (snapshot.sourcePath === activeWatchSourcePath) {
			return;
		}

		clearContextWatcher();
		if (!snapshot.sourcePath) {
			return;
		}

		contextWatcher = watchProjectsContext({
			onChange: () => handleExternalChange(targetPanel),
			sourcePath: snapshot.sourcePath,
		});
		activeWatchSourcePath = snapshot.sourcePath;
	};

	const postState = async (
		workspaceRoot: string,
		targetPanel: WebviewPanel
	) => {
		const snapshot = options.resolveProjectsContext({ workspaceRoot });
		applyAcceptedSnapshot(snapshot);
		syncContextWatcher(snapshot, targetPanel);
		await targetPanel.webview.postMessage({
			command: "ff15-projects-workbench.state",
			snapshot,
		});
	};

	const scheduleSave = async (
		draft: Ff15ProjectsContextDraft,
		targetPanel: WebviewPanel
	) => {
		if (!activeWorkspaceRoot) {
			return;
		}

		clearPendingSave();
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
				await postConflict(targetPanel, { active: false });
				await postAcceptedSnapshot(targetPanel, snapshot, draft);
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

	const handleReloadConflict = async (targetPanel: WebviewPanel) => {
		const snapshot = queuedExternalSnapshot ?? resolveCurrentSnapshot();
		if (!snapshot) {
			await postConflict(targetPanel, { active: false });
			return;
		}

		await postConflict(targetPanel, { active: false });
		await postAcceptedSnapshot(targetPanel, snapshot);
		await postSaveStatus(targetPanel, {
			message: "Projects reloaded from external changes.",
			state: "saved",
		});
	};

	const handleDiscardLocalConflict = async (targetPanel: WebviewPanel) => {
		queuedExternalSnapshot = undefined;
		latestDraft = lastAcceptedDraft;
		await postConflict(targetPanel, { active: false });
		if (lastAcceptedSnapshot) {
			await targetPanel.webview.postMessage({
				command: "ff15-projects-workbench.state",
				snapshot: lastAcceptedSnapshot,
			});
		}
		await postSaveStatus(targetPanel, {
			message: "Local Projects edits discarded.",
			state: "saved",
		});
	};

	const handleKeepLocalConflict = async (targetPanel: WebviewPanel) => {
		queuedExternalSnapshot = undefined;
		await postConflict(targetPanel, { active: false });
		if (latestDraft) {
			await scheduleSave(latestDraft, targetPanel);
			return;
		}

		await postSaveStatus(targetPanel, {
			message: "Keeping local Projects edits.",
			state: "saved",
		});
	};

	const resolveConflict = async (
		resolution: Ff15ProjectsConflictResolution,
		targetPanel: WebviewPanel
	) => {
		switch (resolution) {
			case "reload":
				await handleReloadConflict(targetPanel);
				return;
			case "discard-local":
				await handleDiscardLocalConflict(targetPanel);
				return;
			case "keep-local":
				await handleKeepLocalConflict(targetPanel);
				return;
			default:
				return;
		}
	};

	const bindPanelMessages = (targetPanel: WebviewPanel) => {
		targetPanel.webview.onDidReceiveMessage(async (message) => {
			switch (message.command) {
				case "ff15-projects-workbench.ready":
					if (activeWorkspaceRoot) {
						await postState(activeWorkspaceRoot, targetPanel);
					}
					return;
				case "ff15-projects-workbench.updateDraft":
					latestDraft = message.draft as Ff15ProjectsContextDraft;
					await scheduleSave(
						message.draft as Ff15ProjectsContextDraft,
						targetPanel
					);
					return;
				case "ff15-projects-workbench.resolveConflict":
					await resolveConflict(
						message.resolution as Ff15ProjectsConflictResolution,
						targetPanel
					);
					return;
				default:
					return;
			}
		});
	};

	return {
		onDidChangeProjectsContext: (listener: () => void) => {
			projectsContextChangeListeners.add(listener);
			return {
				dispose: () => {
					projectsContextChangeListeners.delete(listener);
				},
			};
		},
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
				clearPendingSave();
				clearContextWatcher();
				lastAcceptedDraft = undefined;
				lastAcceptedSnapshot = undefined;
				latestDraft = undefined;
				queuedExternalSnapshot = undefined;
				panel = undefined;
				activeWorkspaceRoot = undefined;
			});

			await postState(workspaceRoot, panel);
		},
	};
};
