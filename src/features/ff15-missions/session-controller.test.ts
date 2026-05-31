import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	createFf15MissionSessionController,
	MISSING_MISSION_WORKSPACE_MESSAGE,
	MISSING_MISSION_ZELLIJ_MESSAGE,
} from "./session-controller";
import {
	createEmptyFf15MissionAgentPanes,
	createWorkspaceStateFf15MissionsStore,
} from "./state";

const MISSION_SESSION_NAME_PATTERN = /^ff15-[a-f0-9]{10}-mission-1$/;

const createStorage = () => {
	let persistedSnapshot:
		| ReturnType<typeof createWorkspaceStateFf15MissionsStore>["getSnapshot"]
		| undefined;

	return {
		storage: {
			get: vi.fn(() => persistedSnapshot),
			update: vi.fn().mockImplementation((_key: string, value) => {
				persistedSnapshot = value;
				return Promise.resolve(undefined);
			}),
		},
	};
};

const createWorkspaceRoot = (): string =>
	mkdtempSync(join(tmpdir(), "ff15-session-controller-"));

const createLaunchClient = () => ({
	ensureDependenciesAvailable: vi.fn().mockResolvedValue(undefined),
	getMissingDependencyMessage: vi
		.fn()
		.mockReturnValue(
			"FF15 launch requires GitHub Copilot CLI `copilot` on PATH."
		),
	getPaneLaunchPlan: vi.fn().mockReturnValue([
		{
			agentId: "noctis",
			args: ["--agent", "noctis"],
			executable: "copilot",
		},
	]),
});

const createAgentPanes = () => ({
	...createEmptyFf15MissionAgentPanes(),
	gladiolus: "terminal_1",
	ignis: "terminal_2",
	noctis: "terminal_0",
	prompto: "terminal_3",
});

describe("createFf15MissionSessionController", () => {
	it("creates a mission without opening its dedicated terminal session", async () => {
		const workspaceRoot = createWorkspaceRoot();

		try {
			const { storage } = createStorage();
			const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: () => "2026-05-26T00:10:00.000Z",
				getWorkspaceRoot: () => workspaceRoot,
			});
			const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
			const launchClient = createLaunchClient();
			const launchTerminal = vi.fn().mockResolvedValue(undefined);
			const controller = createFf15MissionSessionController({
				ensureCommandAvailable,
				getLaunchClient: () => launchClient,
				getLaunchLayoutPath: vi
					.fn()
					.mockReturnValue(`${workspaceRoot}/.ff15/layout.kdl`),
				getWorkspaceRoot: () => workspaceRoot,
				launchTerminal,
				missionsStore,
				reconcileMissionAgentPanes: vi
					.fn()
					.mockResolvedValue(createAgentPanes()),
				showErrorMessage: vi.fn(),
				terminateMissionSession: vi.fn().mockResolvedValue(undefined),
			});

			const snapshot = await controller.createMission();

			expect(ensureCommandAvailable).not.toHaveBeenCalled();
			expect(launchClient.ensureDependenciesAvailable).not.toHaveBeenCalled();
			expect(launchTerminal).not.toHaveBeenCalled();
			expect(snapshot.missions).toEqual([
				expect.objectContaining({
					id: "mission-1",
					lastError: null,
					sessionName: null,
					status: "draft",
					workspaceRoot,
				}),
			]);
			expect(missionsStore.getMissionRecord("mission-1")).toEqual(
				expect.objectContaining({
					agentPanes: createEmptyFf15MissionAgentPanes(),
				})
			);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("selects an existing mission without reopening its terminal", async () => {
		const workspaceRoot = createWorkspaceRoot();

		try {
			const { storage } = createStorage();
			const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: () => "2026-05-26T00:10:00.000Z",
				getWorkspaceRoot: () => workspaceRoot,
			});
			await missionsStore.createMission();

			const controller = createFf15MissionSessionController({
				ensureCommandAvailable: vi.fn().mockResolvedValue(undefined),
				getLaunchClient: createLaunchClient,
				getLaunchLayoutPath: vi
					.fn()
					.mockReturnValue(`${workspaceRoot}/.ff15/layout.kdl`),
				getWorkspaceRoot: () => workspaceRoot,
				launchTerminal: vi.fn().mockResolvedValue(undefined),
				missionsStore,
				reconcileMissionAgentPanes: vi
					.fn()
					.mockResolvedValue(createAgentPanes()),
				showErrorMessage: vi.fn(),
				terminateMissionSession: vi.fn().mockResolvedValue(undefined),
			});

			const snapshot = await controller.selectMission("mission-1");

			expect(snapshot.activeMissionId).toBe("mission-1");
			expect(snapshot.missions).toEqual([
				expect.objectContaining({
					id: "mission-1",
					lastError: null,
					sessionName: null,
					status: "draft",
				}),
			]);
			expect(missionsStore.getMissionRecord("mission-1")).toEqual(
				expect.objectContaining({
					agentPanes: createEmptyFf15MissionAgentPanes(),
				})
			);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("opens a mission terminal only when explicitly requested", async () => {
		const workspaceRoot = createWorkspaceRoot();

		try {
			const { storage } = createStorage();
			const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: () => "2026-05-26T00:10:00.000Z",
				getWorkspaceRoot: () => workspaceRoot,
			});
			await missionsStore.createMission();

			const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
			const launchClient = createLaunchClient();
			const launchTerminal = vi.fn().mockResolvedValue(undefined);
			const controller = createFf15MissionSessionController({
				ensureCommandAvailable,
				getLaunchClient: () => launchClient,
				getLaunchLayoutPath: vi
					.fn()
					.mockReturnValue(`${workspaceRoot}/.ff15/layout.kdl`),
				getWorkspaceRoot: () => workspaceRoot,
				launchTerminal,
				missionsStore,
				reconcileMissionAgentPanes: vi
					.fn()
					.mockResolvedValue(createAgentPanes()),
				showErrorMessage: vi.fn(),
				terminateMissionSession: vi.fn().mockResolvedValue(undefined),
			});

			const snapshot = await controller.openMissionSession("mission-1");

			expect(ensureCommandAvailable).toHaveBeenCalledWith("zellij");
			expect(launchClient.ensureDependenciesAvailable).toHaveBeenCalledTimes(1);
			expect(launchTerminal).toHaveBeenCalledWith({
				args: [
					"attach",
					"--create",
					expect.stringMatching(MISSION_SESSION_NAME_PATTERN),
					"options",
					"--default-layout",
					`${workspaceRoot}/.ff15/layout.kdl`,
				],
				cwd: workspaceRoot,
				executable: "zellij",
				name: "FF15 Mission 1",
			});
			expect(snapshot.missions).toEqual([
				expect.objectContaining({
					id: "mission-1",
					lastError: null,
					sessionName: expect.stringMatching(MISSION_SESSION_NAME_PATTERN),
					status: "active",
					workspaceRoot,
				}),
			]);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("deletes the mission after terminating its session", async () => {
		const workspaceRoot = createWorkspaceRoot();

		try {
			const { storage } = createStorage();
			const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: () => "2026-05-26T00:10:00.000Z",
				getWorkspaceRoot: () => workspaceRoot,
			});
			await missionsStore.createMission();
			await missionsStore.updateMission("mission-1", {
				sessionName: "ff15-session",
				status: "active",
				workspaceRoot,
			});

			const terminateMissionSession = vi.fn().mockResolvedValue(undefined);
			const controller = createFf15MissionSessionController({
				ensureCommandAvailable: vi.fn().mockResolvedValue(undefined),
				getLaunchClient: createLaunchClient,
				getLaunchLayoutPath: vi
					.fn()
					.mockReturnValue(`${workspaceRoot}/.ff15/layout.kdl`),
				getWorkspaceRoot: () => workspaceRoot,
				launchTerminal: vi.fn().mockResolvedValue(undefined),
				missionsStore,
				reconcileMissionAgentPanes: vi
					.fn()
					.mockResolvedValue(createAgentPanes()),
				showErrorMessage: vi.fn(),
				terminateMissionSession,
			});
			const onDidChangeMissionSnapshot = vi.fn();
			controller.onDidChangeMissionSnapshot(onDidChangeMissionSnapshot);

			const snapshot = await controller.deleteMission("mission-1");

			expect(terminateMissionSession).toHaveBeenCalledWith({
				sessionName: "ff15-session",
				workspaceRoot,
			});
			expect(snapshot).toEqual({
				activeMissionId: null,
				missions: [],
			});
			expect(onDidChangeMissionSnapshot).toHaveBeenCalledWith(snapshot);
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
		const showErrorMessage = vi.fn();
		const controller = createFf15MissionSessionController({
			ensureCommandAvailable: vi.fn().mockResolvedValue(undefined),
			getLaunchClient: createLaunchClient,
			getLaunchLayoutPath: vi.fn().mockReturnValue("C:/repo/.ff15/layout.kdl"),
			getWorkspaceRoot: () => ["C:/repo"][1],
			launchTerminal: vi.fn().mockResolvedValue(undefined),
			missionsStore,
			reconcileMissionAgentPanes: vi.fn().mockResolvedValue(createAgentPanes()),
			showErrorMessage,
			terminateMissionSession: vi.fn().mockResolvedValue(undefined),
		});

		const snapshot = await controller.openMissionSession("mission-1");

		expect(showErrorMessage).toHaveBeenCalledWith(
			MISSING_MISSION_WORKSPACE_MESSAGE
		);
		expect(snapshot.missions).toEqual([
			expect.objectContaining({
				id: "mission-1",
				lastError: MISSING_MISSION_WORKSPACE_MESSAGE,
				status: "error",
				workspaceRoot: null,
			}),
		]);
	});

	it("stores a zellij availability error when the binary is unavailable", async () => {
		const workspaceRoot = createWorkspaceRoot();

		try {
			const { storage } = createStorage();
			const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: () => "2026-05-26T00:10:00.000Z",
				getWorkspaceRoot: () => workspaceRoot,
			});
			await missionsStore.createMission();
			const showErrorMessage = vi.fn();
			const controller = createFf15MissionSessionController({
				ensureCommandAvailable: vi
					.fn()
					.mockRejectedValue(new Error("missing zellij")),
				getLaunchClient: createLaunchClient,
				getLaunchLayoutPath: vi
					.fn()
					.mockReturnValue(`${workspaceRoot}/.ff15/layout.kdl`),
				getWorkspaceRoot: () => workspaceRoot,
				launchTerminal: vi.fn().mockResolvedValue(undefined),
				missionsStore,
				reconcileMissionAgentPanes: vi
					.fn()
					.mockResolvedValue(createAgentPanes()),
				showErrorMessage,
				terminateMissionSession: vi.fn().mockResolvedValue(undefined),
			});

			const snapshot = await controller.openMissionSession("mission-1");

			expect(showErrorMessage).toHaveBeenCalledWith(
				MISSING_MISSION_ZELLIJ_MESSAGE
			);
			expect(snapshot.missions).toEqual([
				expect.objectContaining({
					id: "mission-1",
					lastError: MISSING_MISSION_ZELLIJ_MESSAGE,
					status: "error",
					workspaceRoot,
				}),
			]);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});
});
