import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
	ViewColumn: {
		Active: 1,
	},
}));

import { ViewColumn } from "vscode";
import {
	createFf15MissionWorkbenchController,
	FF15_MISSION_WORKBENCH_PANEL_VIEW_TYPE,
} from "./workbench-controller";
import { createDefaultFf15MissionAgentModels } from "./model-contract";

const createEmptyWorkflowState = () => ({
	activeTask: null,
	currentStep: null,
	lastReportSummary: null,
	probe: {
		checkedAt: null,
		summary: null,
		verdict: null,
	},
	runtimeStatus: null,
});

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
		triggerDispose: () => {
			disposeHandler?.();
		},
	};
};

describe("createFf15MissionWorkbenchController", () => {
	it("projects the fixed party roster with pane availability and fallback model values", async () => {
		const missionPanel = createPanelDouble();
		const agentModels = createDefaultFf15MissionAgentModels();
		agentModels.ignis = { effort: "3", modelId: "gpt-5-mini" };
		const missionsStore = {
			getMissionRecord: vi.fn(() => ({
				agentModels,
				agentPanes: {
					gladiolus: null,
					ignis: "terminal_2",
					noctis: "terminal_1",
					prompto: null,
				},
				createdAt: "2026-06-01T00:00:00.000Z",
				id: "mission-1",
				lastError: null,
				operationRef: null,
				schemaVersion: 1 as const,
				sessionName: "ff15-session",
				status: "active" as const,
				title: "Mission 1",
				updatedAt: "2026-06-01T00:00:00.000Z",
				workflow: createEmptyWorkflowState(),
				workspaceRoot: "C:/repo",
			})),
			updateMission: vi.fn(),
		};
		const controller = createFf15MissionWorkbenchController({
			createWebviewPanel: vi.fn().mockReturnValue(missionPanel.panel),
			extensionUri: { fsPath: "C:/extension" } as never,
			loadOperationsCatalog: vi.fn().mockResolvedValue({
				supported: [],
				unsupported: [],
			}),
			missionSendController: {
				submitPrompt: vi.fn(),
			},
			missionSessionController: {
				deleteMission: vi.fn(),
				isMissionTerminalReady: vi.fn().mockReturnValue(true),
				openMissionSession: vi.fn(),
				selectMission: vi.fn(),
			},
			missionsStore: missionsStore as never,
			renderWebviewContent: vi.fn().mockReturnValue("<html />"),
		});

		await controller.showMission("mission-1");

		expect(missionPanel.panel.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-mission-workbench.state",
			state: expect.objectContaining({
				modelCatalog: expect.arrayContaining([
					expect.objectContaining({ name: "GPT-5.4" }),
					expect.objectContaining({ name: "GPT-5 mini" }),
				]),
				partyRoster: [
					expect.objectContaining({
						agentId: "noctis",
						available: true,
						model: expect.objectContaining({
							effort: "1",
							effortLabel: "Low",
							modelName: "GPT-5.4",
						}),
						paneId: "terminal_1",
					}),
					expect.objectContaining({
						agentId: "ignis",
						available: true,
						model: expect.objectContaining({
							effort: "3",
							effortLabel: "High",
							modelName: "GPT-5 mini",
						}),
						paneId: "terminal_2",
					}),
					expect.objectContaining({
						agentId: "gladiolus",
						available: false,
						paneId: null,
					}),
					expect.objectContaining({
						agentId: "prompto",
						available: false,
						paneId: null,
					}),
				],
			}),
		});
	});

	it("routes party roster Continue and model messages through the action controller", async () => {
		const missionPanel = createPanelDouble();
		const missionAgentActionController = {
			changeAgentModel: vi.fn().mockResolvedValue(undefined),
			continueAgent: vi.fn().mockResolvedValue(undefined),
		};
		const missionsStore = {
			getMissionRecord: vi.fn(() => ({
				agentModels: createDefaultFf15MissionAgentModels(),
				agentPanes: {
					gladiolus: null,
					ignis: "terminal_2",
					noctis: "terminal_1",
					prompto: null,
				},
				createdAt: "2026-06-01T00:00:00.000Z",
				id: "mission-1",
				lastError: null,
				operationRef: null,
				schemaVersion: 1 as const,
				sessionName: "ff15-session",
				status: "active" as const,
				title: "Mission 1",
				updatedAt: "2026-06-01T00:00:00.000Z",
				workflow: createEmptyWorkflowState(),
				workspaceRoot: "C:/repo",
			})),
			updateMission: vi.fn(),
		};
		const controller = createFf15MissionWorkbenchController({
			createWebviewPanel: vi.fn().mockReturnValue(missionPanel.panel),
			extensionUri: { fsPath: "C:/extension" } as never,
			loadOperationsCatalog: vi.fn().mockResolvedValue({
				supported: [],
				unsupported: [],
			}),
			missionAgentActionController,
			missionSendController: {
				submitPrompt: vi.fn(),
			},
			missionSessionController: {
				deleteMission: vi.fn(),
				openMissionSession: vi.fn(),
				selectMission: vi.fn(),
			},
			missionsStore: missionsStore as never,
			renderWebviewContent: vi.fn().mockReturnValue("<html />"),
		});

		await controller.showMission("mission-1");
		const onDidReceiveMessage = missionPanel.panel.webview.onDidReceiveMessage
			.mock.calls[0]?.[0] as
			| ((message: {
					agentId?: string;
					command: string;
					effort?: string;
					modelId?: string;
			  }) => Promise<void>)
			| undefined;

		await onDidReceiveMessage?.({
			agentId: "ignis",
			command: "ff15-mission-workbench.continue-agent",
		});
		await onDidReceiveMessage?.({
			agentId: "ignis",
			command: "ff15-mission-workbench.change-agent-model",
			effort: "2",
			modelId: "gpt-5-mini",
		});

		expect(missionAgentActionController.continueAgent).toHaveBeenCalledWith({
			agentId: "ignis",
			missionId: "mission-1",
		});
		expect(missionAgentActionController.changeAgentModel).toHaveBeenCalledWith({
			agentId: "ignis",
			effort: "2",
			missionId: "mission-1",
			modelId: "gpt-5-mini",
		});
	});

	it("creates a dedicated editor panel per mission and reuses it when the same mission is focused again", async () => {
		const missionOnePanel = createPanelDouble();
		const missionTwoPanel = createPanelDouble();
		const createWebviewPanel = vi
			.fn()
			.mockReturnValueOnce(missionOnePanel.panel)
			.mockReturnValueOnce(missionTwoPanel.panel);
		const missionsStore = {
			getMissionRecord: vi.fn((missionId: string) => ({
				agentPanes: {
					gladiolus: null,
					ignis: null,
					noctis: null,
					prompto: null,
				},
				createdAt: "2026-05-27T00:00:00.000Z",
				id: missionId,
				lastError: null,
				operationRef: null,
				schemaVersion: 1 as const,
				sessionName: missionId === "mission-1" ? "ff15-1" : "ff15-2",
				status: "draft" as const,
				title: missionId === "mission-1" ? "Mission 1" : "Mission 2",
				updatedAt: "2026-05-27T00:00:00.000Z",
				workflow: createEmptyWorkflowState(),
				workspaceRoot: "C:/repo",
			})),
			updateMission: vi.fn(),
		};
		const controller = createFf15MissionWorkbenchController({
			createWebviewPanel,
			extensionUri: { fsPath: "C:/extension" } as never,
			loadOperationsCatalog: vi.fn().mockResolvedValue({
				supported: [],
				unsupported: [],
			}),
			missionSendController: {
				submitPrompt: vi.fn(),
			},
			missionSessionController: {
				deleteMission: vi.fn(),
				openMissionSession: vi.fn(),
				selectMission: vi.fn(),
			},
			missionsStore: missionsStore as never,
			renderWebviewContent: vi.fn().mockReturnValue("<html />"),
		});

		await controller.showMission("mission-1");
		await controller.showMission("mission-1");
		await controller.showMission("mission-2");

		expect(createWebviewPanel).toHaveBeenNthCalledWith(
			1,
			FF15_MISSION_WORKBENCH_PANEL_VIEW_TYPE,
			"Mission 1",
			ViewColumn.Active,
			expect.objectContaining({
				enableScripts: true,
				retainContextWhenHidden: true,
			})
		);
		expect(createWebviewPanel).toHaveBeenNthCalledWith(
			2,
			FF15_MISSION_WORKBENCH_PANEL_VIEW_TYPE,
			"Mission 2",
			ViewColumn.Active,
			expect.anything()
		);
		expect(createWebviewPanel).toHaveBeenCalledTimes(2);
		expect(missionOnePanel.panel.reveal).toHaveBeenCalledWith(
			ViewColumn.Active,
			false
		);
		expect(missionOnePanel.panel.webview.html).toBe("<html />");
		expect(missionOnePanel.panel.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-mission-workbench.state",
			state: expect.objectContaining({
				mission: expect.objectContaining({
					id: "mission-1",
					title: "Mission 1",
				}),
			}),
		});
		expect(missionTwoPanel.panel.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-mission-workbench.state",
			state: expect.objectContaining({
				mission: expect.objectContaining({
					id: "mission-2",
					title: "Mission 2",
				}),
			}),
		});
	});

	it("persists a supported operationRef selection and ignores unsupported entries", async () => {
		const missionPanel = createPanelDouble();
		const record = {
			agentPanes: {
				gladiolus: null,
				ignis: null,
				noctis: null,
				prompto: null,
			},
			createdAt: "2026-05-27T00:00:00.000Z",
			id: "mission-1",
			lastError: "Select an operation before sending a mission prompt.",
			operationRef: null,
			schemaVersion: 1 as const,
			sessionName: "ff15-1",
			status: "draft" as const,
			title: "Mission 1",
			updatedAt: "2026-05-27T00:00:00.000Z",
			workflow: createEmptyWorkflowState(),
			workspaceRoot: "C:/repo",
		};
		const missionsStore = {
			getMissionRecord: vi.fn(() => record),
			updateMission: vi.fn(
				(
					_missionId: string,
					patch: { lastError?: string | null; operationRef?: string }
				) => {
					if (patch.lastError === null) {
						record.lastError = null;
					}

					if (typeof patch.operationRef === "string") {
						record.operationRef = patch.operationRef;
					}

					return Promise.resolve();
				}
			),
		};
		const loadOperationsCatalog = vi.fn().mockResolvedValue({
			supported: [
				{
					fileName: "noctis-autonomous.yaml",
					name: "noctis-autonomous",
					ref: "builtin:noctis-autonomous",
					supported: true,
					unavailableReason: null,
				},
			],
			unsupported: [
				{
					fileName: "lunafreya-autonomous.yaml",
					name: "lunafreya-autonomous",
					ref: "builtin:lunafreya-autonomous",
					supported: false,
					unavailableReason: "Requires unsupported agents: lunafreya",
				},
			],
		});
		const controller = createFf15MissionWorkbenchController({
			createWebviewPanel: vi.fn().mockReturnValue(missionPanel.panel),
			extensionUri: { fsPath: "C:/extension" } as never,
			loadOperationsCatalog,
			missionSendController: {
				submitPrompt: vi.fn(),
			},
			missionSessionController: {
				deleteMission: vi.fn(),
				openMissionSession: vi.fn(),
				selectMission: vi.fn(),
			},
			missionsStore: missionsStore as never,
			renderWebviewContent: vi.fn().mockReturnValue("<html />"),
		});

		await controller.showMission("mission-1");
		const onDidReceiveMessage = missionPanel.panel.webview.onDidReceiveMessage
			.mock.calls[0]?.[0] as
			| ((message: { command: string; operationRef?: string }) => Promise<void>)
			| undefined;

		await onDidReceiveMessage?.({
			command: "ff15-mission-workbench.select-operation",
			operationRef: "builtin:lunafreya-autonomous",
		});
		await onDidReceiveMessage?.({
			command: "ff15-mission-workbench.select-operation",
			operationRef: "builtin:noctis-autonomous",
		});

		expect(missionsStore.updateMission).toHaveBeenCalledTimes(1);
		expect(missionsStore.updateMission).toHaveBeenCalledWith("mission-1", {
			lastError: null,
			operationRef: "builtin:noctis-autonomous",
		});
		expect(record.operationRef).toBe("builtin:noctis-autonomous");
		expect(missionPanel.panel.webview.postMessage).toHaveBeenLastCalledWith({
			command: "ff15-mission-workbench.state",
			state: expect.objectContaining({
				mission: expect.objectContaining({
					operationRef: "builtin:noctis-autonomous",
				}),
			}),
		});
	});

	it("persists a mission title rename and refreshes the panel title", async () => {
		const missionPanel = createPanelDouble();
		const record = {
			agentPanes: {
				gladiolus: null,
				ignis: null,
				noctis: null,
				prompto: null,
			},
			createdAt: "2026-06-01T00:00:00.000Z",
			id: "mission-1",
			lastError: null,
			operationRef: null,
			schemaVersion: 1 as const,
			sessionName: "ff15-1",
			status: "draft" as const,
			title: "Mission 1",
			updatedAt: "2026-06-01T00:00:00.000Z",
			workflow: createEmptyWorkflowState(),
			workspaceRoot: "C:/repo",
		};
		const renameMission = vi.fn((_missionId: string, title: string) => {
			record.title = title;
			return Promise.resolve();
		});
		const missionsStore = {
			getMissionRecord: vi.fn(() => record),
			updateMission: vi.fn(),
		};
		const controller = createFf15MissionWorkbenchController({
			createWebviewPanel: vi.fn().mockReturnValue(missionPanel.panel),
			extensionUri: { fsPath: "C:/extension" } as never,
			loadOperationsCatalog: vi.fn().mockResolvedValue({
				supported: [],
				unsupported: [],
			}),
			missionSendController: {
				submitPrompt: vi.fn(),
			},
			missionSessionController: {
				deleteMission: vi.fn(),
				openMissionSession: vi.fn(),
				renameMission,
				selectMission: vi.fn(),
			},
			missionsStore: missionsStore as never,
			renderWebviewContent: vi.fn().mockReturnValue("<html />"),
		});

		await controller.showMission("mission-1");
		const onDidReceiveMessage = missionPanel.panel.webview.onDidReceiveMessage
			.mock.calls[0]?.[0] as
			| ((message: { command: string; title?: string }) => Promise<void>)
			| undefined;

		await onDidReceiveMessage?.({
			command: "ff15-mission-workbench.rename-title",
			title: "Customer onboarding handoff",
		});

		expect(renameMission).toHaveBeenCalledWith(
			"mission-1",
			"Customer onboarding handoff"
		);
		expect(missionsStore.updateMission).not.toHaveBeenCalled();
		expect(record.title).toBe("Customer onboarding handoff");
		expect(missionPanel.panel.title).toBe("Customer onboarding handoff");
		expect(missionPanel.panel.webview.postMessage).toHaveBeenLastCalledWith({
			command: "ff15-mission-workbench.state",
			state: expect.objectContaining({
				mission: expect.objectContaining({
					title: "Customer onboarding handoff",
				}),
			}),
		});
	});

	it("opens the mission terminal only from the explicit workbench action", async () => {
		const missionPanel = createPanelDouble();
		let terminalReady = false;
		const openMissionSession = vi.fn().mockImplementation(() => {
			terminalReady = true;
			return Promise.resolve(undefined);
		});
		const controller = createFf15MissionWorkbenchController({
			createWebviewPanel: vi.fn().mockReturnValue(missionPanel.panel),
			extensionUri: { fsPath: "C:/extension" } as never,
			loadOperationsCatalog: vi.fn().mockResolvedValue({
				supported: [],
				unsupported: [],
			}),
			missionSendController: {
				submitPrompt: vi.fn(),
			},
			missionSessionController: {
				deleteMission: vi.fn(),
				isMissionTerminalReady: () => terminalReady,
				openMissionSession,
				selectMission: vi.fn(),
			},
			missionsStore: {
				getMissionRecord: vi.fn(() => ({
					agentPanes: {
						gladiolus: null,
						ignis: null,
						noctis: null,
						prompto: null,
					},
					createdAt: "2026-05-27T00:00:00.000Z",
					id: "mission-1",
					lastError: null,
					operationRef: null,
					schemaVersion: 1 as const,
					sessionName: null,
					status: "draft" as const,
					title: "Mission 1",
					updatedAt: "2026-05-27T00:00:00.000Z",
					workflow: createEmptyWorkflowState(),
					workspaceRoot: "C:/repo",
				})),
				updateMission: vi.fn(),
			} as never,
			renderWebviewContent: vi.fn().mockReturnValue("<html />"),
		});

		await controller.showMission("mission-1");
		const onDidReceiveMessage = missionPanel.panel.webview.onDidReceiveMessage
			.mock.calls[0]?.[0] as
			| ((message: { command: string }) => Promise<void>)
			| undefined;

		await onDidReceiveMessage?.({
			command: "ff15-mission-workbench.open-terminal",
		});

		expect(openMissionSession).toHaveBeenCalledWith("mission-1");
		expect(missionPanel.panel.webview.postMessage).toHaveBeenLastCalledWith({
			command: "ff15-mission-workbench.state",
			state: expect.objectContaining({
				mission: expect.objectContaining({
					terminalReady: true,
				}),
			}),
		});
	});

	it("publishes runtime probe state transitions for an operation-backed mission when the workbench becomes ready", async () => {
		const missionPanel = createPanelDouble();
		const record = {
			agentPanes: {
				gladiolus: null,
				ignis: null,
				noctis: null,
				prompto: null,
			},
			createdAt: "2026-05-27T00:00:00.000Z",
			id: "mission-1",
			lastError: null,
			operationRef: "builtin:noctis-autonomous",
			schemaVersion: 1 as const,
			sessionName: null,
			status: "draft" as const,
			title: "Mission 1",
			updatedAt: "2026-05-27T00:00:00.000Z",
			workflow: createEmptyWorkflowState(),
			workspaceRoot: "C:/repo",
		};
		const ensureMissionRuntime = vi.fn(async () => {
			record.workflow = {
				...record.workflow,
				activeTask: "Validate loopback bridge readiness",
				currentStep: "probe:starting",
				runtimeStatus: "starting",
			};

			await Promise.resolve();

			record.workflow = {
				activeTask: "Validate loopback bridge readiness",
				currentStep: "probe:ready",
				lastReportSummary: "Bridge lookup and submission endpoints responded.",
				probe: {
					checkedAt: "2026-05-27T15:01:00.000Z",
					summary:
						"Extension-host bridge is viable for the next runtime slice.",
					verdict: "go",
				},
				runtimeStatus: "ready",
			};
		});
		const controller = createFf15MissionWorkbenchController({
			createWebviewPanel: vi.fn().mockReturnValue(missionPanel.panel),
			extensionUri: { fsPath: "C:/extension" } as never,
			loadOperationsCatalog: vi.fn().mockResolvedValue({
				supported: [
					{
						fileName: "noctis-autonomous.yaml",
						name: "noctis-autonomous",
						ref: "builtin:noctis-autonomous",
						supported: true,
						unavailableReason: null,
					},
				],
				unsupported: [],
			}),
			missionSendController: {
				submitPrompt: vi.fn(),
			},
			missionSessionController: {
				deleteMission: vi.fn(),
				openMissionSession: vi.fn(),
				selectMission: vi.fn(),
			},
			missionsStore: {
				getMissionRecord: vi.fn(() => record),
				updateMission: vi.fn(),
			} as never,
			operationRuntimeProbeService: {
				ensureMissionRuntime,
			},
			renderWebviewContent: vi.fn().mockReturnValue("<html />"),
		});

		await controller.showMission("mission-1");
		const onDidReceiveMessage = missionPanel.panel.webview.onDidReceiveMessage
			.mock.calls[0]?.[0] as
			| ((message: { command: string }) => Promise<void>)
			| undefined;

		await onDidReceiveMessage?.({
			command: "ff15-mission-workbench.ready",
		});

		expect(ensureMissionRuntime).toHaveBeenCalledWith("mission-1");
		expect(missionPanel.panel.webview.postMessage).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				state: expect.objectContaining({
					mission: expect.objectContaining({
						workflow: expect.objectContaining({
							currentStep: "probe:starting",
							runtimeStatus: "starting",
						}),
					}),
				}),
			})
		);
		expect(missionPanel.panel.webview.postMessage).toHaveBeenNthCalledWith(
			3,
			expect.objectContaining({
				state: expect.objectContaining({
					mission: expect.objectContaining({
						workflow: expect.objectContaining({
							probe: expect.objectContaining({
								verdict: "go",
							}),
							runtimeStatus: "ready",
						}),
					}),
				}),
			})
		);
	});

	it("reopens a hydrated operation-backed mission without losing the saved workflow continuation state", async () => {
		const missionPanel = createPanelDouble();
		const record = {
			agentPanes: {
				gladiolus: "terminal_1",
				ignis: "terminal_2",
				noctis: "terminal_0",
				prompto: "terminal_3",
			},
			createdAt: "2026-05-28T00:00:00.000Z",
			id: "mission-1",
			lastError: null,
			operationRef: "builtin:shiritori-smoke-test",
			schemaVersion: 1 as const,
			sessionName: "ff15-session",
			status: "active" as const,
			title: "Mission 1",
			updatedAt: "2026-05-28T00:01:00.000Z",
			workflow: {
				activeTask: "Ignis Turn",
				currentStep: "ignis-turn",
				lastReportSummary: "りんご",
				probe: {
					checkedAt: "2026-05-28T00:01:00.000Z",
					summary:
						"Extension-host bridge is viable for the next runtime slice.",
					verdict: "go" as const,
				},
				runtimeStatus: "ready" as const,
			},
			workspaceRoot: "C:/repo",
		};
		const ensureMissionRuntime = vi.fn().mockResolvedValue(undefined);
		const controller = createFf15MissionWorkbenchController({
			createWebviewPanel: vi.fn().mockReturnValue(missionPanel.panel),
			extensionUri: { fsPath: "C:/extension" } as never,
			loadOperationsCatalog: vi.fn().mockResolvedValue({
				supported: [
					{
						fileName: "shiritori-smoke-test.yaml",
						name: "shiritori-smoke-test",
						ref: "builtin:shiritori-smoke-test",
						supported: true,
						unavailableReason: null,
					},
				],
				unsupported: [],
			}),
			missionSendController: {
				submitPrompt: vi.fn(),
			},
			missionSessionController: {
				deleteMission: vi.fn(),
				openMissionSession: vi.fn(),
				selectMission: vi.fn(),
			},
			missionsStore: {
				getMissionRecord: vi.fn(() => record),
				updateMission: vi.fn(),
			} as never,
			operationRuntimeProbeService: {
				ensureMissionRuntime,
			},
			renderWebviewContent: vi.fn().mockReturnValue("<html />"),
		});

		await controller.showMission("mission-1");
		expect(missionPanel.panel.webview.postMessage).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				state: expect.objectContaining({
					mission: expect.objectContaining({
						operationRef: "builtin:shiritori-smoke-test",
						sessionName: "ff15-session",
						workflow: expect.objectContaining({
							activeTask: "Ignis Turn",
							currentStep: "ignis-turn",
							runtimeStatus: "ready",
						}),
					}),
				}),
			})
		);

		const onDidReceiveMessage = missionPanel.panel.webview.onDidReceiveMessage
			.mock.calls[0]?.[0] as
			| ((message: { command: string }) => Promise<void>)
			| undefined;

		await onDidReceiveMessage?.({
			command: "ff15-mission-workbench.ready",
		});

		expect(ensureMissionRuntime).toHaveBeenCalledWith("mission-1");
		expect(missionPanel.panel.webview.postMessage).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				state: expect.objectContaining({
					mission: expect.objectContaining({
						workflow: expect.objectContaining({
							activeTask: "Ignis Turn",
							currentStep: "ignis-turn",
							runtimeStatus: "ready",
						}),
					}),
				}),
			})
		);
		expect(missionPanel.panel.webview.postMessage).toHaveBeenNthCalledWith(
			3,
			expect.objectContaining({
				state: expect.objectContaining({
					mission: expect.objectContaining({
						workflow: expect.objectContaining({
							activeTask: "Ignis Turn",
							currentStep: "ignis-turn",
							runtimeStatus: "ready",
						}),
					}),
				}),
			})
		);
	});
});
