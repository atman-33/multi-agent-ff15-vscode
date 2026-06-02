import { describe, expect, it, vi } from "vitest";
import { createFf15MissionAgentActionController } from "./agent-actions";
import {
	createDefaultFf15MissionAgentModels,
	type Ff15MissionAgentModels,
} from "./model-contract";
import {
	createEmptyFf15MissionAgentPanes,
	createEmptyFf15MissionWorkflowState,
} from "./state";

const createMissionRecord = (input?: {
	agentModels?: Ff15MissionAgentModels;
	noctisPaneId?: string | null;
}) => ({
	agentModels: input?.agentModels ?? createDefaultFf15MissionAgentModels(),
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
	schemaVersion: 1 as const,
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
			inputs: ["Continue"],
			paneId: "terminal_1",
			sessionName: "ff15-session",
		});
		expect(updateMission).toHaveBeenCalledWith("mission-1", {
			agentPanes: missionRecord.agentPanes,
			lastError: null,
		});
		expect(reconcileMissionAgentPanes).not.toHaveBeenCalled();
	});

	it("routes OpenCode model changes with model-scoped effort input and persists the selection", async () => {
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
			inputs: ["/model", "GPT-5.4", "3"],
			paneId: "terminal_1",
			sessionName: "ff15-session",
		});
		expect(updateMission).toHaveBeenCalledWith("mission-1", {
			agentModels: {
				...missionRecord.agentModels,
				noctis: { effort: "3", modelId: "gpt-5.4" },
			},
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
			inputs: ["/model", "Instant"],
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
			inputs: ["/model", "GPT-5 mini", "2"],
			paneId: "terminal_9",
			sessionName: "ff15-session",
		});
		expect(updateMission).toHaveBeenCalledWith("mission-1", {
			agentModels: {
				...missionRecord.agentModels,
				noctis: { effort: "2", modelId: "gpt-5-mini" },
			},
			agentPanes: {
				...missionRecord.agentPanes,
				noctis: "terminal_9",
			},
			lastError: null,
		});
	});
});
