import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Ff15LaunchClient } from "../ff15-launch/launch-client";
import {
	createFf15MissionSendController,
	MISSING_WORKSPACE_MESSAGE,
	MISSING_ZELLIJ_MESSAGE,
} from "./controller";
import {
	createEmptyFf15MissionAgentPanes,
	type Ff15MissionsStoreSnapshot,
	createWorkspaceStateFf15MissionsStore,
} from "./state";

const MISSION_SESSION_NAME_PATTERN = /^ff15-[a-f0-9]{10}-mission-1$/;
type TestMissionsStateStorage = Parameters<
	typeof createWorkspaceStateFf15MissionsStore
>[0];

const createStorage = () => {
	let persistedSnapshot: Ff15MissionsStoreSnapshot | undefined;
	const storage: TestMissionsStateStorage = {
		get: <T>() => persistedSnapshot as T | undefined,
		update: vi
			.fn()
			.mockImplementation((_key: string, value: Ff15MissionsStoreSnapshot) => {
				persistedSnapshot = value;
				return Promise.resolve(undefined);
			}),
	};

	return {
		storage,
	};
};

const createNoctisPaneLaunchPlanEntry = () =>
	({
		agentId: "noctis",
		args: ["--agent", "noctis"],
		executable: "copilot",
	}) as const;

const createLaunchClient = (): Ff15LaunchClient => ({
	id: "github-copilot-cli",
	ensureDependenciesAvailable: vi.fn().mockResolvedValue(undefined),
	getMissingDependencyMessage: vi
		.fn()
		.mockReturnValue(
			"FF15 launch requires GitHub Copilot CLI `copilot` on PATH."
		),
	getPaneLaunchPlan: vi
		.fn()
		.mockReturnValue([createNoctisPaneLaunchPlanEntry()]),
});

const createAgentPanes = (noctisPaneId: string | null) => ({
	...createEmptyFf15MissionAgentPanes(),
	noctis: noctisPaneId,
});

const seedPersistedMission = async (
	storage: ReturnType<typeof createStorage>["storage"],
	workspaceRoot: string
) => {
	const seedStore = createWorkspaceStateFf15MissionsStore(storage, {
		createId: () => "mission-1",
		getNow: vi
			.fn()
			.mockReturnValueOnce("2026-05-26T00:10:00.000Z")
			.mockReturnValueOnce("2026-05-26T00:11:00.000Z"),
		getWorkspaceRoot: () => workspaceRoot,
	});

	await seedStore.createMission();
	await seedStore.updateMission("mission-1", {
		agentPanes: createAgentPanes("terminal_7"),
		lastError: null,
		sessionName: "ff15-session",
		status: "active",
		workspaceRoot,
	});
};

describe("createFf15MissionSendController", () => {
	it("launches or attaches the mission session and marks the mission active after the first prompt is delivered", async () => {
		const { storage } = createStorage();
		const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
			createId: () => "mission-1",
			getNow: () => "2026-05-26T00:10:00.000Z",
		});
		await missionsStore.createMission();

		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const launchClient = createLaunchClient();
		const missionTransport = {
			ensureMissionSession: vi.fn().mockResolvedValue({
				agentPanes: createAgentPanes("terminal_7"),
				paneId: "terminal_7",
			}),
			sendPrompt: vi.fn().mockResolvedValue(undefined),
		};

		const controller = createFf15MissionSendController({
			ensureCommandAvailable,
			getLaunchClient: () => launchClient,
			getWorkspaceRoot: () => "C:/repo",
			missionTransport,
			missionsStore,
		});

		const snapshot = await controller.submitPrompt({
			missionId: "mission-1",
			prompt: "Investigate the regression",
		});

		expect(ensureCommandAvailable).toHaveBeenCalledWith("zellij");
		expect(launchClient.ensureDependenciesAvailable).toHaveBeenCalledTimes(1);
		expect(missionTransport.ensureMissionSession).toHaveBeenCalledWith(
			expect.objectContaining({
				agentPanes: createAgentPanes(null),
				missionId: "mission-1",
				paneLaunchPlanEntry: createNoctisPaneLaunchPlanEntry(),
				workspaceRoot: "C:/repo",
			})
		);
		expect(missionTransport.sendPrompt).toHaveBeenCalledWith(
			expect.objectContaining({
				paneId: "terminal_7",
				prompt: "Investigate the regression",
			})
		);
		expect(snapshot.activeMissionId).toBe("mission-1");
		expect(snapshot.missions).toEqual([
			expect.objectContaining({
				id: "mission-1",
				lastError: null,
				sessionName: expect.stringMatching(MISSION_SESSION_NAME_PATTERN),
				status: "active",
				workspaceRoot: "C:/repo",
			}),
		]);
		expect(missionsStore.getMissionRecord("mission-1")).toEqual(
			expect.objectContaining({
				agentPanes: createAgentPanes("terminal_7"),
				sessionName: expect.stringMatching(MISSION_SESSION_NAME_PATTERN),
			})
		);
	});

	it("rehydrates persisted mission metadata and reuses the existing session for follow-up prompts", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-missions-"));

		try {
			const { storage } = createStorage();
			await seedPersistedMission(storage, workspaceRoot);

			const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
				getWorkspaceRoot: () => workspaceRoot,
			});
			const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
			const launchClient = createLaunchClient();
			const missionTransport = {
				ensureMissionSession: vi.fn().mockResolvedValue({
					agentPanes: createAgentPanes("terminal_7"),
					paneId: "terminal_7",
				}),
				sendPrompt: vi.fn().mockResolvedValue(undefined),
			};

			const controller = createFf15MissionSendController({
				ensureCommandAvailable,
				getLaunchClient: () => launchClient,
				getWorkspaceRoot: () => workspaceRoot,
				missionTransport,
				missionsStore,
			});

			const snapshot = await controller.submitPrompt({
				missionId: "mission-1",
				prompt: "Resume the work",
			});

			expect(missionsStore.getMissionRecord("mission-1")).toEqual(
				expect.objectContaining({
					agentPanes: createAgentPanes("terminal_7"),
					sessionName: "ff15-session",
					workspaceRoot,
				})
			);
			expect(missionTransport.ensureMissionSession).toHaveBeenCalledWith(
				expect.objectContaining({
					allowCreateNoctisPane: false,
					agentPanes: createAgentPanes("terminal_7"),
					missionId: "mission-1",
					sessionName: "ff15-session",
					workspaceRoot,
				})
			);
			expect(missionTransport.sendPrompt).toHaveBeenCalledWith({
				paneId: "terminal_7",
				prompt: "Resume the work",
				sessionName: "ff15-session",
			});
			expect(snapshot.missions).toEqual([
				expect.objectContaining({
					id: "mission-1",
					lastError: null,
					sessionName: "ff15-session",
					status: "active",
					workspaceRoot,
				}),
			]);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("stores a recoverable error when an existing mission no longer resolves a live Noctis pane", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-missions-"));

		try {
			const { storage } = createStorage();
			await seedPersistedMission(storage, workspaceRoot);

			const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
				getWorkspaceRoot: () => workspaceRoot,
			});
			const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
			const launchClient = createLaunchClient();
			const missionTransport = {
				ensureMissionSession: vi
					.fn()
					.mockRejectedValue(
						new Error(
							"FF15 could not resolve a live Noctis pane for this mission. Start a new mission to continue."
						)
					),
				sendPrompt: vi.fn().mockResolvedValue(undefined),
			};

			const controller = createFf15MissionSendController({
				ensureCommandAvailable,
				getLaunchClient: () => launchClient,
				getWorkspaceRoot: () => workspaceRoot,
				missionTransport,
				missionsStore,
			});

			const snapshot = await controller.submitPrompt({
				missionId: "mission-1",
				prompt: "Resume the work",
			});

			expect(missionTransport.sendPrompt).not.toHaveBeenCalled();
			expect(snapshot.missions).toEqual([
				expect.objectContaining({
					id: "mission-1",
					lastError:
						"FF15 could not resolve a live Noctis pane for this mission. Start a new mission to continue.",
					sessionName: "ff15-session",
					status: "error",
					workspaceRoot,
				}),
			]);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("stores a mission-scoped error when no workspace root can be resolved", async () => {
		const { storage } = createStorage();
		const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
			createId: () => "mission-1",
			getNow: () => "2026-05-26T00:10:00.000Z",
		});
		await missionsStore.createMission();

		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const launchClient = createLaunchClient();
		const missionTransport = {
			ensureMissionSession: vi.fn().mockResolvedValue({
				paneId: "terminal_7",
			}),
			sendPrompt: vi.fn().mockResolvedValue(undefined),
		};

		const controller = createFf15MissionSendController({
			ensureCommandAvailable,
			getLaunchClient: () => launchClient,
			getWorkspaceRoot: () => ["C:/repo"][1],
			missionTransport,
			missionsStore,
		});

		const snapshot = await controller.submitPrompt({
			missionId: "mission-1",
			prompt: "Investigate the regression",
		});

		expect(snapshot.missions).toEqual([
			expect.objectContaining({
				id: "mission-1",
				lastError: MISSING_WORKSPACE_MESSAGE,
				status: "error",
				sessionName: null,
				workspaceRoot: null,
			}),
		]);
		expect(ensureCommandAvailable).not.toHaveBeenCalled();
		expect(launchClient.ensureDependenciesAvailable).not.toHaveBeenCalled();
		expect(missionTransport.ensureMissionSession).not.toHaveBeenCalled();
	});

	it("stores the transport failure on the selected mission when prompt delivery fails", async () => {
		const { storage } = createStorage();
		const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
			createId: () => "mission-1",
			getNow: () => "2026-05-26T00:10:00.000Z",
		});
		await missionsStore.createMission();

		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const launchClient = createLaunchClient();
		const missionTransport = {
			ensureMissionSession: vi.fn().mockResolvedValue({
				agentPanes: createAgentPanes("terminal_7"),
				paneId: "terminal_7",
			}),
			sendPrompt: vi
				.fn()
				.mockRejectedValue(new Error("Noctis pane is unavailable.")),
		};

		const controller = createFf15MissionSendController({
			ensureCommandAvailable,
			getLaunchClient: () => launchClient,
			getWorkspaceRoot: () => "C:/repo",
			missionTransport,
			missionsStore,
		});

		const snapshot = await controller.submitPrompt({
			missionId: "mission-1",
			prompt: "Investigate the regression",
		});

		expect(snapshot.missions).toEqual([
			expect.objectContaining({
				id: "mission-1",
				lastError: "Noctis pane is unavailable.",
				sessionName: expect.stringMatching(MISSION_SESSION_NAME_PATTERN),
				status: "error",
				workspaceRoot: "C:/repo",
			}),
		]);
		expect(missionsStore.getMissionRecord("mission-1")).toEqual(
			expect.objectContaining({
				agentPanes: createAgentPanes("terminal_7"),
			})
		);
	});

	it("stores a zellij availability error when zellij is unavailable", async () => {
		const { storage } = createStorage();
		const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
			createId: () => "mission-1",
			getNow: () => "2026-05-26T00:10:00.000Z",
		});
		await missionsStore.createMission();

		const ensureCommandAvailable = vi
			.fn()
			.mockRejectedValue(new Error("missing zellij"));
		const launchClient = createLaunchClient();
		const missionTransport = {
			ensureMissionSession: vi.fn().mockResolvedValue({
				paneId: "terminal_7",
			}),
			sendPrompt: vi.fn().mockResolvedValue(undefined),
		};

		const controller = createFf15MissionSendController({
			ensureCommandAvailable,
			getLaunchClient: () => launchClient,
			getWorkspaceRoot: () => "C:/repo",
			missionTransport,
			missionsStore,
		});

		const snapshot = await controller.submitPrompt({
			missionId: "mission-1",
			prompt: "Investigate the regression",
		});

		expect(snapshot.missions).toEqual([
			expect.objectContaining({
				id: "mission-1",
				lastError: MISSING_ZELLIJ_MESSAGE,
				status: "error",
				workspaceRoot: "C:/repo",
			}),
		]);
		expect(launchClient.ensureDependenciesAvailable).not.toHaveBeenCalled();
		expect(missionTransport.ensureMissionSession).not.toHaveBeenCalled();
	});
});
