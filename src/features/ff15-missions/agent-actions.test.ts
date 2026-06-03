import { describe, expect, it, vi } from "vitest";
import { createFf15MissionAgentActionController } from "./agent-actions";
import {
	createDefaultFf15MissionAgentModels,
	createDefaultFf15MissionProviderState,
	type Ff15MissionAgentModels,
} from "./model-contract";
import {
	createEmptyFf15MissionAgentPanes,
	createEmptyFf15MissionWorkflowState,
} from "./state";

const createMissionRecord = (input?: {
	agentModels?: Ff15MissionAgentModels;
	providerId?: "github-copilot-cli" | "opencode";
	noctisPaneId?: string | null;
}) => ({
	agentPanes: {
		...createEmptyFf15MissionAgentPanes(),
		noctis:
			input && "noctisPaneId" in input
				? (input.noctisPaneId ?? null)
				: "terminal_1",
	},
	createdAt: "2026-06-01T00:00:00.000Z",
	id: "mission-1",
	lastError: null,
	operationRef: null,
	providerId: input?.providerId ?? "github-copilot-cli",
	providerState: {
		...createDefaultFf15MissionProviderState(),
		"github-copilot-cli": {
			agentModels: input?.agentModels ?? createDefaultFf15MissionAgentModels(),
		},
	},
	schemaVersion: 2 as const,
	sessionName: "ff15-session",
	status: "active" as const,
	title: "Mission 1",
	updatedAt: "2026-06-01T00:00:00.000Z",
	workflow: createEmptyFf15MissionWorkflowState(),
	workspaceRoot: "C:/repo",
});

describe("createFf15MissionAgentActionController", () => {
	it("routes raw Continue to the selected live agent pane", async () => {
		const missionRecord = createMissionRecord();
		const updateMission = vi.fn().mockResolvedValue({ missions: [] });
		const reconcileMissionAgentPanes = vi
			.fn()
			.mockResolvedValue(missionRecord.agentPanes);
		const sendPaneInputSequence = vi.fn().mockResolvedValue(undefined);
		const controller = createFf15MissionAgentActionController({
			missionTransport: { reconcileMissionAgentPanes, sendPaneInputSequence },
			missionsStore: {
				getMissionRecord: vi.fn().mockReturnValue(missionRecord),
				getSnapshot: vi.fn(),
				updateMission,
			} as never,
		});

		await controller.continueAgent({
			agentId: "noctis",
			missionId: "mission-1",
		});

		expect(sendPaneInputSequence).toHaveBeenCalledWith({
			steps: [{ kind: "write", value: "Continue" }, { kind: "enter" }],
			paneId: "terminal_1",
			sessionName: "ff15-session",
		});
		expect(updateMission).toHaveBeenCalledWith("mission-1", {
			agentPanes: missionRecord.agentPanes,
			lastError: null,
		});
		expect(reconcileMissionAgentPanes).not.toHaveBeenCalled();
	});

	it("routes OpenCode Continue through the shared adapter path", async () => {
		const missionRecord = createMissionRecord({
			providerId: "opencode",
		});
		const updateMission = vi.fn().mockResolvedValue({ missions: [] });
		const sendPaneInputSequence = vi.fn().mockResolvedValue(undefined);
		const controller = createFf15MissionAgentActionController({
			missionTransport: {
				reconcileMissionAgentPanes: vi.fn(),
				sendPaneInputSequence,
			},
			missionsStore: {
				getMissionRecord: vi.fn().mockReturnValue(missionRecord),
				getSnapshot: vi.fn(),
				updateMission,
			} as never,
		});

		await controller.continueAgent({
			agentId: "noctis",
			missionId: "mission-1",
		});

		expect(sendPaneInputSequence).toHaveBeenCalledWith({
			steps: [{ kind: "write", value: "Continue" }, { kind: "enter" }],
			paneId: "terminal_1",
			sessionName: "ff15-session",
		});
		expect(updateMission).toHaveBeenCalledWith("mission-1", {
			agentPanes: missionRecord.agentPanes,
			lastError: null,
		});
	});

	it("routes GitHub Copilot model changes with model-scoped effort input and persists the selection", async () => {
		const missionRecord = createMissionRecord();
		const updateMission = vi.fn().mockResolvedValue({ missions: [] });
		const reconcileMissionAgentPanes = vi
			.fn()
			.mockResolvedValue(missionRecord.agentPanes);
		const sendPaneInputSequence = vi.fn().mockResolvedValue(undefined);
		const controller = createFf15MissionAgentActionController({
			missionTransport: { reconcileMissionAgentPanes, sendPaneInputSequence },
			missionsStore: {
				getMissionRecord: vi.fn().mockReturnValue(missionRecord),
				getSnapshot: vi.fn(),
				updateMission,
			} as never,
		});

		await controller.changeAgentModel({
			agentId: "noctis",
			effort: "3",
			missionId: "mission-1",
			modelId: "gpt-5.4",
		});

		expect(sendPaneInputSequence).toHaveBeenCalledWith({
			steps: [
				{ kind: "write", value: "/model" },
				{ kind: "enter" },
				{ kind: "write", value: "GPT-5.4" },
				{ kind: "enter" },
				{ kind: "write", value: "3" },
				{ kind: "enter" },
			],
			paneId: "terminal_1",
			sessionName: "ff15-session",
		});
		expect(updateMission).toHaveBeenCalledWith("mission-1", {
			providerState: expect.objectContaining({
				"github-copilot-cli": {
					agentModels: expect.objectContaining({
						noctis: { effort: "3", modelId: "gpt-5.4" },
					}),
				},
			}),
			agentPanes: missionRecord.agentPanes,
			lastError: null,
		});
	});

	it("routes OpenCode model changes through the shared adapter path", async () => {
		const missionRecord = createMissionRecord({
			providerId: "opencode",
		});
		const updateMission = vi.fn().mockResolvedValue({ missions: [] });
		const sendPaneInputSequence = vi.fn().mockResolvedValue(undefined);
		const controller = createFf15MissionAgentActionController({
			modelCatalog: [
				{
					efforts: [{ label: "Low", value: "low" }],
					id: "github-copilot/gpt-5.4",
					name: "GPT-5.4",
				},
			],
			missionTransport: {
				reconcileMissionAgentPanes: vi.fn(),
				sendPaneInputSequence,
			},
			missionsStore: {
				getMissionRecord: vi.fn().mockReturnValue(missionRecord),
				getSnapshot: vi.fn(),
				updateMission,
			} as never,
		});

		await controller.changeAgentModel({
			agentId: "noctis",
			effort: "low",
			missionId: "mission-1",
			modelId: "github-copilot/gpt-5.4",
		});

		expect(sendPaneInputSequence).toHaveBeenCalledWith({
			steps: [
				{ kind: "write", value: "/models" },
				{ kind: "enter" },
				{ kind: "write", value: "GPT-5.4" },
				{ kind: "enter" },
				{ kind: "enter" },
				{ kind: "write", value: "/variants" },
				{ kind: "enter" },
				{ kind: "write", value: "low" },
				{ kind: "enter" },
			],
			paneId: "terminal_1",
			sessionName: "ff15-session",
		});
		expect(updateMission).toHaveBeenCalledWith("mission-1", {
			providerState: expect.objectContaining({
				opencode: {
					agentModels: expect.objectContaining({
						noctis: {
							effort: "low",
							modelId: "github-copilot/gpt-5.4",
						},
					}),
				},
			}),
			agentPanes: missionRecord.agentPanes,
			lastError: null,
		});
	});

	it("skips the variant command for OpenCode models without explicit variants", async () => {
		const missionRecord = createMissionRecord({
			providerId: "opencode",
		});
		const updateMission = vi.fn().mockResolvedValue({ missions: [] });
		const sendPaneInputSequence = vi.fn().mockResolvedValue(undefined);
		const controller = createFf15MissionAgentActionController({
			modelCatalog: [
				{
					efforts: [],
					id: "anthropic/claude-haiku-4.5",
					name: "Claude Haiku 4.5",
				},
			],
			missionTransport: {
				reconcileMissionAgentPanes: vi.fn(),
				sendPaneInputSequence,
			},
			missionsStore: {
				getMissionRecord: vi.fn().mockReturnValue(missionRecord),
				getSnapshot: vi.fn(),
				updateMission,
			} as never,
		});

		await controller.changeAgentModel({
			agentId: "noctis",
			effort: null,
			missionId: "mission-1",
			modelId: "anthropic/claude-haiku-4.5",
		});

		expect(sendPaneInputSequence).toHaveBeenCalledWith({
			steps: [
				{ kind: "write", value: "/models" },
				{ kind: "enter" },
				{ kind: "write", value: "Claude Haiku 4.5" },
				{ kind: "enter" },
			],
			paneId: "terminal_1",
			sessionName: "ff15-session",
		});
		expect(updateMission).toHaveBeenCalledWith("mission-1", {
			providerState: expect.objectContaining({
				opencode: {
					agentModels: expect.objectContaining({
						noctis: {
							effort: null,
							modelId: "anthropic/claude-haiku-4.5",
						},
					}),
				},
			}),
			agentPanes: missionRecord.agentPanes,
			lastError: null,
		});
	});

	it("skips the effort input for models that do not expose effort options", async () => {
		const missionRecord = createMissionRecord();
		const reconcileMissionAgentPanes = vi
			.fn()
			.mockResolvedValue(missionRecord.agentPanes);
		const sendPaneInputSequence = vi.fn().mockResolvedValue(undefined);
		const controller = createFf15MissionAgentActionController({
			modelCatalog: [{ efforts: [], id: "instant", name: "Instant" }],
			missionTransport: { reconcileMissionAgentPanes, sendPaneInputSequence },
			missionsStore: {
				getMissionRecord: vi.fn().mockReturnValue(missionRecord),
				getSnapshot: vi.fn(),
				updateMission: vi.fn().mockResolvedValue({ missions: [] }),
			} as never,
		});

		await controller.changeAgentModel({
			agentId: "noctis",
			effort: null,
			missionId: "mission-1",
			modelId: "instant",
		});

		expect(sendPaneInputSequence).toHaveBeenCalledWith({
			steps: [
				{ kind: "write", value: "/model" },
				{ kind: "enter" },
				{ kind: "write", value: "Instant" },
				{ kind: "enter" },
			],
			paneId: "terminal_1",
			sessionName: "ff15-session",
		});
	});

	it("reconciles panes on demand when the roster card is enabled before pane ids are cached", async () => {
		const missionRecord = createMissionRecord({ noctisPaneId: null });
		const reconcileMissionAgentPanes = vi.fn().mockResolvedValue({
			...missionRecord.agentPanes,
			noctis: "terminal_9",
		});
		const updateMission = vi.fn().mockResolvedValue({ missions: [] });
		const sendPaneInputSequence = vi.fn().mockResolvedValue(undefined);
		const controller = createFf15MissionAgentActionController({
			missionTransport: { reconcileMissionAgentPanes, sendPaneInputSequence },
			missionsStore: {
				getMissionRecord: vi.fn().mockReturnValue(missionRecord),
				getSnapshot: vi.fn(),
				updateMission,
			} as never,
		});

		await controller.changeAgentModel({
			agentId: "noctis",
			effort: "2",
			missionId: "mission-1",
			modelId: "gpt-5-mini",
		});

		expect(reconcileMissionAgentPanes).toHaveBeenCalledWith({
			agentPanes: missionRecord.agentPanes,
			sessionName: "ff15-session",
			workspaceRoot: "C:/repo",
		});
		expect(sendPaneInputSequence).toHaveBeenCalledWith({
			steps: [
				{ kind: "write", value: "/model" },
				{ kind: "enter" },
				{ kind: "write", value: "GPT-5 mini" },
				{ kind: "enter" },
				{ kind: "write", value: "2" },
				{ kind: "enter" },
			],
			paneId: "terminal_9",
			sessionName: "ff15-session",
		});
		expect(updateMission).toHaveBeenCalledWith("mission-1", {
			providerState: expect.objectContaining({
				"github-copilot-cli": {
					agentModels: expect.objectContaining({
						noctis: { effort: "2", modelId: "gpt-5-mini" },
					}),
				},
			}),
			agentPanes: {
				...missionRecord.agentPanes,
				noctis: "terminal_9",
			},
			lastError: null,
		});
	});
});
