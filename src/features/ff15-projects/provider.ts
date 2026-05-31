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
	type Ff15ProjectsContextSnapshot,
} from "./context-resolver";

const FF15_PROJECTS_PAGE_ID = "ff15-projects";

interface Ff15ProjectsViewProviderDependencies {
	getWorkspaceRoot?: () => string | undefined;
	resolveProjectsContext?: (input: {
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
	private latestSnapshot: Ff15ProjectsContextSnapshot = {
		activeProjects: [],
		configVersion: null,
		error: "Unable to resolve workspace root for Projects view.",
		openspec: {
			mode: null,
			path: null,
			sourceProjectId: null,
		},
		sourceKind: null,
		sourcePath: null,
		status: "error",
	};
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
			if (message.command === "ff15-projects.ready") {
				this.postSnapshot(this.resolveSnapshot());
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
				sourceKind: null,
				sourcePath: null,
				status: "error",
			};
		}

		return this.resolveProjectsContext({ workspaceRoot });
	}

	private postSnapshot(snapshot: Ff15ProjectsContextSnapshot) {
		this.latestSnapshot = snapshot;
		this.view?.webview.postMessage({
			command: "ff15-projects.state",
			snapshot,
		});
	}
}
