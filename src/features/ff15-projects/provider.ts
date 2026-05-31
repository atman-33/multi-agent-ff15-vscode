import type {
	CancellationToken,
	Uri,
	WebviewView,
	WebviewViewProvider,
	WebviewViewResolveContext,
} from "vscode";
import { FF15_PROJECTS_VIEW_ID } from "../../config/extension-ids";
import { getWebviewContent } from "../../lib/webview/get-webview-content";
import { resolveActiveWorkspaceRoot } from "../ff15-launch/workspace-root";
import {
	resolveFf15ProjectsContext,
	saveFf15ProjectsContext,
	type Ff15ProjectsContextDraft,
	type Ff15ProjectsContextSnapshot,
} from "./context-resolver";

const FF15_PROJECTS_PAGE_ID = "ff15-projects";
const FF15_PROJECTS_SAVE_DEBOUNCE_MS = 400;

interface Ff15ProjectsViewProviderDependencies {
	getWorkspaceRoot?: () => string | undefined;
	resolveProjectsContext?: (input: {
		workspaceRoot: string;
	}) => Ff15ProjectsContextSnapshot;
	saveProjectsContext?: (input: {
		draft: Ff15ProjectsContextDraft;
		workspaceRoot: string;
	}) => Ff15ProjectsContextSnapshot;
}

export class Ff15ProjectsViewProvider implements WebviewViewProvider {
	static readonly viewId = FF15_PROJECTS_VIEW_ID;

	private readonly extensionUri: Uri;
	private readonly getWorkspaceRoot: () => string | undefined;
	private readonly resolveProjectsContext: (input: {
		workspaceRoot: string;
	}) => Ff15ProjectsContextSnapshot;
	private readonly saveProjectsContext: (input: {
		draft: Ff15ProjectsContextDraft;
		workspaceRoot: string;
	}) => Ff15ProjectsContextSnapshot;
	private latestSnapshot: Ff15ProjectsContextSnapshot = {
		activeProjects: [],
		configVersion: null,
		error: "Unable to resolve workspace root for Projects view.",
		openspec: {
			mode: null,
			path: null,
			sourceProjectId: null,
		},
		profiles: [],
		sourceKind: null,
		sourcePath: null,
		status: "error",
	};
	private pendingSaveTimer?: ReturnType<typeof setTimeout>;
	private view?: WebviewView;

	constructor(
		extensionUri: Uri,
		dependencies: Ff15ProjectsViewProviderDependencies = {}
	) {
		this.extensionUri = extensionUri;
		this.getWorkspaceRoot =
			dependencies.getWorkspaceRoot ?? resolveActiveWorkspaceRoot;
		this.resolveProjectsContext =
			dependencies.resolveProjectsContext ?? resolveFf15ProjectsContext;
		this.saveProjectsContext =
			dependencies.saveProjectsContext ?? saveFf15ProjectsContext;
	}

	resolveWebviewView(
		webviewView: WebviewView,
		_context: WebviewViewResolveContext,
		_token: CancellationToken
	) {
		this.view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri],
		};

		webviewView.webview.html = getWebviewContent(
			webviewView.webview,
			this.extensionUri,
			FF15_PROJECTS_PAGE_ID
		);

		webviewView.webview.onDidReceiveMessage((message) => {
			switch (message.command) {
				case "ff15-projects.ready": {
					this.postSnapshot(this.resolveSnapshot());
					return;
				}
				case "ff15-projects.updateDraft": {
					this.scheduleSave(message.draft as Ff15ProjectsContextDraft);
					return;
				}
				default:
					return;
			}
		});

		this.postSnapshot(this.resolveSnapshot());
	}

	private resolveSnapshot(): Ff15ProjectsContextSnapshot {
		const workspaceRoot = this.getWorkspaceRoot();
		if (!workspaceRoot) {
			return {
				activeProjects: [],
				configVersion: null,
				error: "Unable to resolve workspace root for Projects view.",
				openspec: {
					mode: null,
					path: null,
					sourceProjectId: null,
				},
				profiles: [],
				sourceKind: null,
				sourcePath: null,
				status: "error",
			};
		}

		return this.resolveProjectsContext({ workspaceRoot });
	}

	private scheduleSave(draft: Ff15ProjectsContextDraft) {
		if (this.pendingSaveTimer) {
			clearTimeout(this.pendingSaveTimer);
		}

		this.postSaveStatus({
			message: "Saving Projects...",
			state: "saving",
		});

		this.pendingSaveTimer = setTimeout(() => {
			const workspaceRoot = this.getWorkspaceRoot();
			if (!workspaceRoot) {
				this.postSnapshot(this.resolveSnapshot());
				this.postSaveStatus({
					message: "Unable to resolve workspace root for Projects view.",
					state: "error",
				});
				this.pendingSaveTimer = undefined;
				return;
			}

			try {
				const snapshot = this.saveProjectsContext({
					draft,
					workspaceRoot,
				});
				this.postSnapshot(snapshot);
				this.postSaveStatus({
					message: "Projects saved.",
					state: "saved",
				});
			} catch (error) {
				const message =
					error instanceof Error
						? error.message
						: "Failed to save Projects context.";
				this.postSnapshot(this.latestSnapshot);
				this.postSaveStatus({
					message,
					state: "error",
				});
			} finally {
				this.pendingSaveTimer = undefined;
			}
		}, FF15_PROJECTS_SAVE_DEBOUNCE_MS);
	}

	private postSaveStatus(payload: {
		message: string;
		state: "error" | "saved" | "saving";
	}) {
		this.view?.webview.postMessage({
			command: "ff15-projects.save-status",
			...payload,
		});
	}

	private postSnapshot(snapshot: Ff15ProjectsContextSnapshot) {
		this.latestSnapshot = snapshot;
		this.view?.webview.postMessage({
			command: "ff15-projects.state",
			snapshot,
		});
	}
}
