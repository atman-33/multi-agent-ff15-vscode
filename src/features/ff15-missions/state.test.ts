import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	createEmptyFf15MissionAgentPanes,
	createWorkspaceStateFf15MissionsStore,
	FF15_MISSIONS_STATE_STORAGE_KEY,
	FF15_WORKSPACE_RUNTIME_DIR_NAME,
} from "./state";

describe("createWorkspaceStateFf15MissionsStore", () => {
	it("creates a mission, marks it active, and persists the snapshot", async () => {
		const update = vi.fn().mockResolvedValue(undefined);
		const storage = {
			get: vi.fn().mockReturnValue(undefined),
			update,
		};
		const store = createWorkspaceStateFf15MissionsStore(storage, {
			createId: () => "mission-1",
			getNow: () => "2026-05-25T00:00:00.000Z",
		});

		const snapshot = await store.createMission();

		expect(snapshot).toEqual({
			activeMissionId: "mission-1",
			missions: [
				{
					createdAt: "2026-05-25T00:00:00.000Z",
					id: "mission-1",
					lastError: null,
					sessionName: null,
					status: "draft",
					title: "Mission 1",
					updatedAt: "2026-05-25T00:00:00.000Z",
					workspaceRoot: null,
				},
			],
		});
		expect(update).toHaveBeenCalledWith(
			FF15_MISSIONS_STATE_STORAGE_KEY,
			snapshot
		);
	});

	it("selects an existing mission and persists the active mission id", async () => {
		const update = vi.fn().mockResolvedValue(undefined);
		const storage = {
			get: vi.fn().mockReturnValue({
				activeMissionId: "mission-1",
				missions: [
					{
						createdAt: "2026-05-25T00:00:00.000Z",
						id: "mission-1",
						lastError: null,
						sessionName: null,
						status: "draft",
						title: "Mission 1",
						updatedAt: "2026-05-25T00:00:00.000Z",
						workspaceRoot: null,
					},
					{
						createdAt: "2026-05-25T00:01:00.000Z",
						id: "mission-2",
						lastError: null,
						sessionName: null,
						status: "active",
						title: "Mission 2",
						updatedAt: "2026-05-25T00:01:00.000Z",
						workspaceRoot: "C:/repo",
					},
				],
			}),
			update,
		};
		const store = createWorkspaceStateFf15MissionsStore(storage);

		const snapshot = await store.selectMission("mission-2");

		expect(snapshot.activeMissionId).toBe("mission-2");
		expect(update).toHaveBeenCalledWith(
			FF15_MISSIONS_STATE_STORAGE_KEY,
			snapshot
		);
	});

	it("updates mission transport metadata and persists the snapshot", async () => {
		const update = vi.fn().mockResolvedValue(undefined);
		const storage = {
			get: vi.fn().mockReturnValue({
				activeMissionId: "mission-1",
				missions: [
					{
						createdAt: "2026-05-25T00:00:00.000Z",
						id: "mission-1",
						lastError: null,
						sessionName: null,
						status: "draft",
						title: "Mission 1",
						updatedAt: "2026-05-25T00:00:00.000Z",
						workspaceRoot: null,
					},
				],
			}),
			update,
		};
		const store = createWorkspaceStateFf15MissionsStore(storage, {
			getNow: () => "2026-05-25T00:02:00.000Z",
		});

		const snapshot = await store.updateMission("mission-1", {
			lastError: null,
			sessionName: "ff15-session",
			status: "active",
			workspaceRoot: "C:/repo",
		});

		expect(snapshot).toEqual({
			activeMissionId: "mission-1",
			missions: [
				{
					createdAt: "2026-05-25T00:00:00.000Z",
					id: "mission-1",
					lastError: null,
					sessionName: "ff15-session",
					status: "active",
					title: "Mission 1",
					updatedAt: "2026-05-25T00:02:00.000Z",
					workspaceRoot: "C:/repo",
				},
			],
		});
		expect(update).toHaveBeenCalledWith(
			FF15_MISSIONS_STATE_STORAGE_KEY,
			snapshot
		);
	});

	it("persists the canonical mission runtime under .ff15 when a workspace root is available", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-missions-"));

		try {
			const update = vi.fn().mockResolvedValue(undefined);
			const storage = {
				get: vi.fn().mockReturnValue(undefined),
				update,
			};
			const store = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: () => "2026-05-25T00:02:00.000Z",
				getWorkspaceRoot: () => workspaceRoot,
			});

			await store.createMission();
			const agentPanes = {
				...createEmptyFf15MissionAgentPanes(),
				noctis: "terminal_7",
			};
			await store.updateMission("mission-1", {
				agentPanes,
				lastError: null,
				sessionName: "ff15-session",
				status: "active",
				workspaceRoot,
			});

			const missionFilePath = join(
				workspaceRoot,
				FF15_WORKSPACE_RUNTIME_DIR_NAME,
				"missions",
				"mission-1",
				"mission.json"
			);

			expect(existsSync(missionFilePath)).toBe(true);
			expect(JSON.parse(readFileSync(missionFilePath, "utf8"))).toEqual(
				expect.objectContaining({
					agentPanes,
					id: "mission-1",
					sessionName: "ff15-session",
					workspaceRoot,
				})
			);
			expect(store.getMissionRecord("mission-1")).toEqual(
				expect.objectContaining({
					agentPanes,
					sessionName: "ff15-session",
					workspaceRoot,
				})
			);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("persists the selected operationRef on the canonical mission runtime record", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-missions-"));

		try {
			const storage = {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
			};
			const store = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: vi
					.fn()
					.mockReturnValueOnce("2026-05-25T00:00:00.000Z")
					.mockReturnValueOnce("2026-05-25T00:03:00.000Z"),
				getWorkspaceRoot: () => workspaceRoot,
			});

			await store.createMission();
			await store.updateMission("mission-1", {
				operationRef: "builtin:noctis-autonomous",
			} as never);

			const missionFilePath = join(
				workspaceRoot,
				FF15_WORKSPACE_RUNTIME_DIR_NAME,
				"missions",
				"mission-1",
				"mission.json"
			);

			expect(store.getMissionRecord("mission-1")).toEqual(
				expect.objectContaining({
					operationRef: "builtin:noctis-autonomous",
				})
			);
			expect(JSON.parse(readFileSync(missionFilePath, "utf8"))).toEqual(
				expect.objectContaining({
					operationRef: "builtin:noctis-autonomous",
				})
			);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("deletes a mission, removes its runtime folder, and retargets the active mission", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-missions-"));

		try {
			const update = vi.fn().mockResolvedValue(undefined);
			const storage = {
				get: vi.fn().mockReturnValue(undefined),
				update,
			};
			const store = createWorkspaceStateFf15MissionsStore(storage, {
				createId: vi
					.fn()
					.mockReturnValueOnce("mission-1")
					.mockReturnValueOnce("mission-2"),
				getNow: vi
					.fn()
					.mockReturnValueOnce("2026-05-25T00:00:00.000Z")
					.mockReturnValueOnce("2026-05-25T00:01:00.000Z"),
				getWorkspaceRoot: () => workspaceRoot,
			});

			await store.createMission();
			await store.createMission();

			const deletedSnapshot = await store.deleteMission("mission-2");
			const missionTwoPath = join(
				workspaceRoot,
				FF15_WORKSPACE_RUNTIME_DIR_NAME,
				"missions",
				"mission-2"
			);

			expect(deletedSnapshot).toEqual({
				activeMissionId: "mission-1",
				missions: [
					{
						createdAt: "2026-05-25T00:00:00.000Z",
						id: "mission-1",
						lastError: null,
						sessionName: null,
						status: "draft",
						title: "Mission 1",
						updatedAt: "2026-05-25T00:00:00.000Z",
						workspaceRoot,
					},
				],
			});
			expect(existsSync(missionTwoPath)).toBe(false);
			expect(store.getMissionRecord("mission-2")).toBeNull();
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("restores a stored snapshot through getSnapshot and normalizes legacy missions", () => {
		const storage = {
			get: vi.fn().mockReturnValue({
				activeMissionId: "mission-2",
				missions: [
					{
						createdAt: "2026-05-25T00:00:00.000Z",
						id: "mission-1",
						title: "Mission 1",
						updatedAt: "2026-05-25T00:00:00.000Z",
					},
					{
						createdAt: "2026-05-25T00:01:00.000Z",
						id: "mission-2",
						lastError: "Noctis pane is unavailable.",
						sessionName: "ff15-session",
						status: "error",
						title: "Mission 2",
						updatedAt: "2026-05-25T00:01:00.000Z",
						workspaceRoot: "C:/repo",
					},
				],
			}),
			update: vi.fn().mockResolvedValue(undefined),
		};
		const store = createWorkspaceStateFf15MissionsStore(storage);

		expect(store.getSnapshot()).toEqual({
			activeMissionId: "mission-2",
			missions: [
				{
					createdAt: "2026-05-25T00:00:00.000Z",
					id: "mission-1",
					lastError: null,
					sessionName: null,
					status: "draft",
					title: "Mission 1",
					updatedAt: "2026-05-25T00:00:00.000Z",
					workspaceRoot: null,
				},
				{
					createdAt: "2026-05-25T00:01:00.000Z",
					id: "mission-2",
					lastError: "Noctis pane is unavailable.",
					sessionName: "ff15-session",
					status: "error",
					title: "Mission 2",
					updatedAt: "2026-05-25T00:01:00.000Z",
					workspaceRoot: "C:/repo",
				},
			],
		});
	});
});
