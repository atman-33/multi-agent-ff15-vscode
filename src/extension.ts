import {
	commands,
	ExtensionMode,
	type ExtensionContext,
	window,
	workspace,
} from "vscode";
import {
	FF15_OPEN_SETTINGS_COMMAND_ID,
	OPENCODE_ADD_SELECTION_TO_CHAT_COMMAND_ID,
	OPENCODE_ADD_TO_CHAT_COMMAND_ID,
	OPENCODE_CHAT_VIEW_ID,
	OPENCODE_RESTART_COMMAND_ID,
	OPENCODE_TOGGLE_CHAT_VIEW_COMMAND_ID,
} from "./config/extension-ids";
import { createActivationDebugLogger } from "./features/debug/activation-logger";
import { materializeBundledFf15WorkspaceTemplateFiles } from "./features/ff15-agents/materialize";
import { resolveActiveWorkspaceRoot } from "./features/ff15-launch/workspace-root";
import { loadBundledOperationsCatalog } from "./features/ff15-operations/catalog";
import { createFf15OperationRuntimeProbeService } from "./features/ff15-operations/runtime-probe";
import { Ff15MissionsViewProvider } from "./features/ff15-missions/provider";
import { createFf15MissionAgentActionController } from "./features/ff15-missions/agent-actions";
import { createFf15OpenCodeModelCatalogLoader } from "./features/ff15-missions/opencode-model-catalog";
import { createWorkspaceStateFf15MissionsStore } from "./features/ff15-missions/state";
import { createFf15MissionZellijTransport } from "./features/ff15-missions/transport";
import {
	createVsCodeFf15MissionSendController,
	createVsCodeFf15MissionSessionController,
} from "./features/ff15-missions/vscode-controller";
import { createFf15MissionWorkbenchController } from "./features/ff15-missions/workbench-controller";
import {
	resolveFf15ProjectsContext,
	saveFf15ProjectsContext,
} from "./features/ff15-projects/context-resolver";
import { resolveFf15ProjectRuntimeContext } from "./features/ff15-projects/runtime-context";
import { Ff15ProjectsViewProvider } from "./features/ff15-projects/provider";
import { createFf15ProjectsWorkbenchController } from "./features/ff15-projects/workbench-controller";
import { openFf15Settings } from "./features/ff15-settings/open-settings";
import { Ff15SettingsViewProvider } from "./features/ff15-settings/provider";
import { OpencodeViewProvider } from "./features/opencode-chat/opencode-view-provider";
import { ServerManager } from "./features/opencode-chat/server-manager";
import { formatSelectionReference } from "./features/opencode-chat/selection-reference";

let activeRuntimeProbeService: ReturnType<
	typeof createFf15OperationRuntimeProbeService
> | null = null;

let opencodeServerManager: ServerManager | undefined;

const SIDEBAR_CMDS = {
	primary: "workbench.action.toggleSidebarVisibility",
	auxiliary: "workbench.action.toggleAuxiliaryBar",
} as const;

export const activate = (context: ExtensionContext) => {
	const debug = createActivationDebugLogger(context);
	if (debug.filePath) {
		console.log(`[FF15] Activation debug log: ${debug.filePath}`);
	}

	try {
		debug.log("activate() entered");
		registerFf15Views(context, debug);
		debug.log("FF15 views registered successfully");
	} catch (err) {
		debug.logError("FF15 activation failed", err);
		const message = err instanceof Error ? err.message : String(err);
		window.showErrorMessage(`FF15 activation failed: ${message}`);
		throw err;
	}

	try {
		debug.log("OpenCode setup started");
		registerOpenCodeChat(context, debug);
		debug.log("OpenCode setup completed");
	} catch (err) {
		debug.logError("OpenCode activation failed", err);
		const message = err instanceof Error ? err.message : String(err);
		window.showErrorMessage(`OpenCode activation failed: ${message}`);
	}

	debug.log("=== activate() returned ===");
};

const registerFf15Views = (
	context: ExtensionContext,
	debug: ReturnType<typeof createActivationDebugLogger>
) => {
	const isDevMode = context.extensionMode === ExtensionMode.Development;
	const activationWorkspaceRoot = resolveActiveWorkspaceRoot();
	debug.log(`workspace root resolved: ${activationWorkspaceRoot ?? "<none>"}`);
	if (activationWorkspaceRoot) {
		debug.log("materializing bundled workspace template files");
		materializeBundledFf15WorkspaceTemplateFiles({
			extensionRoot: context.extensionUri.fsPath,
			workspaceRoot: activationWorkspaceRoot,
		});
		debug.log("workspace template files materialized");
	}

	const getFf15Configuration = () =>
		workspace.getConfiguration("multi-agent-ff15-vscode");
	const getPromptInputDelayMs = () =>
		getFf15Configuration().get<number>("promptInputDelayMs", 500);
	const getApplyModelsBeforeSend = () =>
		getFf15Configuration().get<boolean>("applyModelsBeforeSend", true);

	debug.log("constructing FF15 controllers and providers");
	const ff15MissionsStore = createWorkspaceStateFf15MissionsStore(
		context.workspaceState,
		{
			getWorkspaceRoot: resolveActiveWorkspaceRoot,
		}
	);
	const ff15OpenCodeModelCatalogLoader = createFf15OpenCodeModelCatalogLoader();
	const ff15MissionTransport = createFf15MissionZellijTransport({
		getPromptInputDelayMs,
	});
	const ff15MissionSessionController = createVsCodeFf15MissionSessionController(
		context.extensionUri,
		ff15MissionsStore,
		ff15MissionTransport
	);
	const ff15MissionSendController = createVsCodeFf15MissionSendController(
		ff15MissionsStore,
		ff15MissionTransport,
		ff15MissionSessionController.isMissionTerminalReady
	);
	const ff15MissionAgentActionController =
		createFf15MissionAgentActionController({
			loadOpenCodeModelCatalog: (workspaceRoot) =>
				ff15OpenCodeModelCatalogLoader.readCatalog({
					waitForLatest: true,
					workspaceRoot,
				}),
			missionTransport: ff15MissionTransport,
			missionsStore: ff15MissionsStore,
		});
	const ff15OperationRuntimeProbeService =
		createFf15OperationRuntimeProbeService({
			missionTransport: ff15MissionTransport,
			missionsStore: ff15MissionsStore,
			resolveRuntimeContext: ({ workspaceRoot }) =>
				resolveFf15ProjectRuntimeContext({ workspaceRoot }),
		});
	activeRuntimeProbeService = ff15OperationRuntimeProbeService;
	const ff15MissionWorkbenchController = createFf15MissionWorkbenchController({
		devMode: isDevMode,
		getApplyModelsBeforeSend,
		getPromptInputDelayMs,
		loadOpenCodeModelCatalog: (workspaceRoot) =>
			ff15OpenCodeModelCatalogLoader.readCatalog({
				waitForLatest: true,
				workspaceRoot,
			}),
		missionAgentActionController: ff15MissionAgentActionController,
		missionSendController: ff15MissionSendController,
		missionSessionController: ff15MissionSessionController,
		missionsStore: ff15MissionsStore,
		operationRuntimeProbeService: ff15OperationRuntimeProbeService,
		extensionUri: context.extensionUri,
		loadOperationsCatalog: (workspaceRoot) =>
			loadBundledOperationsCatalog({
				extensionRoot: context.extensionUri.fsPath,
				workspaceRoot,
			}),
	});
	const ff15MissionsViewProvider = new Ff15MissionsViewProvider(
		context.extensionUri,
		ff15MissionsStore,
		{
			devMode: isDevMode,
			missionSendController: ff15MissionSendController,
			missionSessionController: ff15MissionSessionController,
			missionWorkbenchController: ff15MissionWorkbenchController,
		}
	);
	const ff15ProjectsWorkbenchController = createFf15ProjectsWorkbenchController(
		{
			devMode: isDevMode,
			extensionUri: context.extensionUri,
			resolveProjectsContext: resolveFf15ProjectsContext,
			saveProjectsContext: saveFf15ProjectsContext,
		}
	);
	const ff15ProjectsViewProvider = new Ff15ProjectsViewProvider(
		context.extensionUri,
		{
			devMode: isDevMode,
			projectsWorkbenchController: ff15ProjectsWorkbenchController,
		}
	);
	const ff15SettingsViewProvider = new Ff15SettingsViewProvider(
		context.extensionUri,
		isDevMode
	);
	debug.log("FF15 controllers and providers constructed");
	context.subscriptions.push(
		window.registerWebviewViewProvider(
			Ff15ProjectsViewProvider.viewId,
			ff15ProjectsViewProvider
		),
		window.registerWebviewViewProvider(
			Ff15MissionsViewProvider.viewId,
			ff15MissionsViewProvider
		),
		window.registerWebviewViewProvider(
			Ff15SettingsViewProvider.viewId,
			ff15SettingsViewProvider
		),
		commands.registerCommand(FF15_OPEN_SETTINGS_COMMAND_ID, openFf15Settings)
	);
};

const registerOpenCodeChat = (
	context: ExtensionContext,
	debug: ReturnType<typeof createActivationDebugLogger>
) => {
	{
		const opencodeLogger = window.createOutputChannel("OpenCode");
		context.subscriptions.push(opencodeLogger);

		const opencodeConfig = workspace.getConfiguration(
			"multi-agent-ff15-vscode.openCode"
		);
		const userPort = opencodeConfig.get<number>("port", 0);
		const storedPort = context.globalState.get<number>(
			"multi-agent-ff15-vscode.openCode.serverPort"
		);
		const port =
			userPort > 0
				? userPort
				: (storedPort ??
					Math.floor(Math.random() * (65_535 - 16_384 + 1)) + 16_384);

		const storedProxyPort = context.globalState.get<number>(
			"multi-agent-ff15-vscode.openCode.proxyPort"
		);
		const proxyPort =
			storedProxyPort ??
			Math.floor(Math.random() * (65_535 - 16_384 + 1)) + 16_384;

		const exposeToNetwork = opencodeConfig.get<boolean>(
			"exposeToNetwork",
			false
		);
		const opencodePath = opencodeConfig.get<string>("path", "").trim();

		debug.log(
			`OpenCode config resolved (port=${port}, proxyPort=${proxyPort})`
		);
		const opencodeProvider = new OpencodeViewProvider(
			context.extensionUri,
			opencodeLogger
		);
		opencodeProvider.setDevMode(
			context.extensionMode === ExtensionMode.Development
		);

		const cachedSidebarType = context.globalState.get<"primary" | "auxiliary">(
			"multi-agent-ff15-vscode.openCode.sidebarType"
		);
		if (cachedSidebarType) {
			opencodeProvider.sidebarType = cachedSidebarType;
		}

		debug.log(`registering OpenCode webview view: ${OPENCODE_CHAT_VIEW_ID}`);
		context.subscriptions.push(
			window.registerWebviewViewProvider(
				OPENCODE_CHAT_VIEW_ID,
				opencodeProvider,
				{
					webviewOptions: { retainContextWhenHidden: true },
				}
			),
			commands.registerCommand(OPENCODE_ADD_TO_CHAT_COMMAND_ID, (uri?) => {
				const fileUri = uri || window.activeTextEditor?.document.uri;
				if (fileUri) {
					const relativePath = workspace.asRelativePath(fileUri);
					opencodeProvider.addToChat(relativePath);
				}
			}),
			commands.registerCommand(
				OPENCODE_ADD_SELECTION_TO_CHAT_COMMAND_ID,
				() => {
					const editor = window.activeTextEditor;
					if (!editor) {
						return;
					}

					const relativePath = workspace.asRelativePath(editor.document.uri);
					opencodeProvider.addToChat(
						formatSelectionReference(relativePath, editor.selection)
					);
				}
			),
			commands.registerCommand(
				OPENCODE_TOGGLE_CHAT_VIEW_COMMAND_ID,
				async () => {
					if (!opencodeProvider.isViewVisible) {
						await commands.executeCommand(
							"multi-agent-ff15-vscode.openCodeSidebar.chatView.focus"
						);
						return;
					}

					const tryFirst = opencodeProvider.sidebarType ?? "auxiliary";
					await commands.executeCommand(SIDEBAR_CMDS[tryFirst]);

					if (!opencodeProvider.isViewVisible) {
						opencodeProvider.sidebarType = tryFirst;
						await context.globalState.update(
							"multi-agent-ff15-vscode.openCode.sidebarType",
							tryFirst
						);
						return;
					}

					await commands.executeCommand(SIDEBAR_CMDS[tryFirst]);
					const other = tryFirst === "auxiliary" ? "primary" : "auxiliary";
					await commands.executeCommand(SIDEBAR_CMDS[other]);
					opencodeProvider.sidebarType = other;
					await context.globalState.update(
						"multi-agent-ff15-vscode.openCode.sidebarType",
						other
					);
				}
			),
			commands.registerCommand(OPENCODE_RESTART_COMMAND_ID, () => {
				const restartConfig = workspace.getConfiguration(
					"multi-agent-ff15-vscode.openCode"
				);
				const restartUserPort = restartConfig.get<number>("port", 0);
				const restartPort =
					restartUserPort > 0
						? restartUserPort
						: (context.globalState.get<number>(
								"multi-agent-ff15-vscode.openCode.serverPort"
							) ?? port);
				const restartProxyPort =
					context.globalState.get<number>(
						"multi-agent-ff15-vscode.openCode.proxyPort"
					) ?? proxyPort;
				const restartExposeToNetwork = restartConfig.get<boolean>(
					"exposeToNetwork",
					false
				);
				const restartOpencodePath = restartConfig
					.get<string>("path", "")
					.trim();

				opencodeServerManager?.dispose();
				opencodeProvider.setLoading();
				opencodeServerManager = new ServerManager(opencodeLogger);
				opencodeServerManager.start(
					opencodeProvider,
					context,
					restartPort,
					restartProxyPort,
					restartExposeToNetwork,
					restartOpencodePath
				);
			}),
			workspace.onDidChangeConfiguration((e) => {
				if (
					e.affectsConfiguration("multi-agent-ff15-vscode.openCode.port") ||
					e.affectsConfiguration(
						"multi-agent-ff15-vscode.openCode.exposeToNetwork"
					) ||
					e.affectsConfiguration("multi-agent-ff15-vscode.openCode.path")
				) {
					window
						.showInformationMessage(
							"OpenCode settings changed. Restart to apply?",
							"Restart"
						)
						.then((choice) => {
							if (choice === "Restart") {
								commands.executeCommand(OPENCODE_RESTART_COMMAND_ID);
							}
						});
				}
			})
		);

		debug.log("starting OpenCode server manager");
		opencodeServerManager = new ServerManager(opencodeLogger);
		opencodeServerManager
			.start(
				opencodeProvider,
				context,
				port,
				proxyPort,
				exposeToNetwork,
				opencodePath
			)
			.catch((err) => {
				debug.logError("OpenCode server start (async) failed", err);
			});
		debug.log("OpenCode server manager start invoked");
	}
};

export async function deactivate() {
	if (activeRuntimeProbeService) {
		await activeRuntimeProbeService.dispose();
		activeRuntimeProbeService = null;
	}

	opencodeServerManager?.dispose();
	opencodeServerManager = undefined;
}
