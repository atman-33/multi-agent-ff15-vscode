import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type {
	Ff15LaunchClient,
	Ff15LaunchClientId,
} from "../ff15-launch/launch-client";
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
		| ReturnType<
				ReturnType<typeof createWorkspaceStateFf15MissionsStore>["getSnapshot"]
		  >
		| undefined;
	const getStorageValue: Parameters<
		typeof createWorkspaceStateFf15MissionsStore
	>[0]["get"] = <T>(_key: string) => persistedSnapshot as T | undefined;
	const storage: Parameters<typeof createWorkspaceStateFf15MissionsStore>[0] = {
		get: getStorageValue,
		update: vi.fn().mockImplementation((_key: string, value) => {
			persistedSnapshot = value;
			return Promise.resolve(undefined);
		}),
	};

	return {
		storage,
	};
};

const createWorkspaceRoot = (): string =>
	mkdtempSync(join(tmpdir(), "ff15-session-controller-"));

const createLaunchClient = (
	id: Ff15LaunchClientId = "opencode"
): Ff15LaunchClient => ({
	id,
	ensureDependenciesAvailable: vi.fn().mockResolvedValue(undefined),
	getMissingDependencyMessage: vi
		.fn()
		.mockReturnValue(
			id === "opencode"
				? "FF15 launch requires `opencode` on PATH."
				: "FF15 launch requires GitHub Copilot CLI `copilot` on PATH."
		),
	getPaneLaunchPlan: vi.fn().mockReturnValue([
		{
			agentId: "noctis",
			args: ["--agent", "noctis"],
			executable: id === "opencode" ? "opencode" : "copilot",
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
				getPinnedProviderId: () => "github-copilot-cli",
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
					providerId: "opencode",
				})
			);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("opens a mission terminal with the mission's pinned provider", async () => {
		const workspaceRoot = createWorkspaceRoot();

		try {
			const { storage } = createStorage();
			const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: () => "2026-06-03T00:12:00.000Z",
				getWorkspaceRoot: () => workspaceRoot,
			});
			await missionsStore.createMission({ providerId: "opencode" });

			const githubClient = createLaunchClient("github-copilot-cli");
			const opencodeClient = createLaunchClient("opencode");
			const launchTerminal = vi.fn().mockResolvedValue(undefined);
			const controller = createFf15MissionSessionController({
				ensureCommandAvailable: vi.fn().mockResolvedValue(undefined),
				getPinnedProviderId: () => "github-copilot-cli",
				getLaunchClient: (mission) =>
					mission.providerId === "opencode" ? opencodeClient : githubClient,
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

			await controller.openMissionSession("mission-1");

			expect(opencodeClient.ensureDependenciesAvailable).toHaveBeenCalledTimes(
				1
			);
			expect(githubClient.ensureDependenciesAvailable).not.toHaveBeenCalled();
			expect(launchTerminal).toHaveBeenCalledTimes(1);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("pins the current provider when a mission is created", async () => {
		const workspaceRoot = createWorkspaceRoot();

		try {
			const { storage } = createStorage();
			const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: () => "2026-06-03T00:10:00.000Z",
				getWorkspaceRoot: () => workspaceRoot,
			});
			const controller = createFf15MissionSessionController({
				ensureCommandAvailable: vi.fn().mockResolvedValue(undefined),
				getPinnedProviderId: () => "opencode",
				getLaunchClient: () => createLaunchClient(),
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

			await controller.createMission();

			expect(missionsStore.getMissionRecord("mission-1")).toEqual(
				expect.objectContaining({
					providerId: "opencode",
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
				getPinnedProviderId: () => "github-copilot-cli",
				getLaunchClient: () => createLaunchClient(),
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

	it("renames a mission and notifies mission snapshot listeners", async () => {
		const workspaceRoot = createWorkspaceRoot();

		try {
			const { storage } = createStorage();
			const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: vi
					.fn()
					.mockReturnValueOnce("2026-06-01T00:10:00.000Z")
					.mockReturnValueOnce("2026-06-01T00:11:00.000Z"),
				getWorkspaceRoot: () => workspaceRoot,
			});
			await missionsStore.createMission();

			const controller = createFf15MissionSessionController({
				ensureCommandAvailable: vi.fn().mockResolvedValue(undefined),
				getPinnedProviderId: () => "github-copilot-cli",
				getLaunchClient: () => createLaunchClient(),
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
			const onDidChangeMissionSnapshot = vi.fn();
			controller.onDidChangeMissionSnapshot(onDidChangeMissionSnapshot);

			const snapshot = await controller.renameMission(
				"mission-1",
				"Customer onboarding handoff"
			);

			expect(snapshot.missions).toEqual([
				expect.objectContaining({
					id: "mission-1",
					title: "Customer onboarding handoff",
					workspaceRoot,
				}),
			]);
			expect(onDidChangeMissionSnapshot).toHaveBeenCalledWith(snapshot);
			expect(missionsStore.getMissionRecord("mission-1")).toEqual(
				expect.objectContaining({
					title: "Customer onboarding handoff",
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
				getPinnedProviderId: () => "github-copilot-cli",
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
			expect(controller.isMissionTerminalReady("mission-1")).toBe(false);

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
			expect(controller.isMissionTerminalReady("mission-1")).toBe(true);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("retries pane reconciliation after launch until the fixed roster is live", async () => {
		const workspaceRoot = createWorkspaceRoot();

		try {
			const { storage } = createStorage();
			const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: () => "2026-05-26T00:10:00.000Z",
				getWorkspaceRoot: () => workspaceRoot,
			});
			await missionsStore.createMission();

			const reconcileMissionAgentPanes = vi
				.fn()
				.mockResolvedValueOnce(createEmptyFf15MissionAgentPanes())
				.mockResolvedValueOnce(createAgentPanes());
			const waitForMissionAgentPanesReconcile = vi
				.fn()
				.mockResolvedValue(undefined);
			const controller = createFf15MissionSessionController({
				ensureCommandAvailable: vi.fn().mockResolvedValue(undefined),
				getPinnedProviderId: () => "opencode",
				getLaunchClient: () => createLaunchClient(),
				getLaunchLayoutPath: vi
					.fn()
					.mockReturnValue(`${workspaceRoot}/.ff15/layout.kdl`),
				getWorkspaceRoot: () => workspaceRoot,
				launchTerminal: vi.fn().mockResolvedValue(undefined),
				missionsStore,
				reconcileMissionAgentPanes,
				showErrorMessage: vi.fn(),
				terminateMissionSession: vi.fn().mockResolvedValue(undefined),
				waitForMissionAgentPanesReconcile,
			});

			await controller.openMissionSession("mission-1");

			expect(reconcileMissionAgentPanes).toHaveBeenCalledTimes(2);
			expect(waitForMissionAgentPanesReconcile).toHaveBeenCalledTimes(1);
			expect(missionsStore.getMissionRecord("mission-1")).toEqual(
				expect.objectContaining({
					agentPanes: createAgentPanes(),
				})
			);
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
				getPinnedProviderId: () => "opencode",
				getLaunchClient: () => createLaunchClient(),
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
			getPinnedProviderId: () => "opencode",
			getLaunchClient: () => createLaunchClient(),
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
				getPinnedProviderId: () => "opencode",
				getLaunchClient: () => createLaunchClient(),
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
