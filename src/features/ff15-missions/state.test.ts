import { describe, expect, it, vi } from "vitest";
import {
	createWorkspaceStateFf15MissionsStore,
	FF15_MISSIONS_STATE_STORAGE_KEY,
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
					title: "Mission 1",
					updatedAt: "2026-05-25T00:00:00.000Z",
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
						title: "Mission 1",
						updatedAt: "2026-05-25T00:00:00.000Z",
					},
					{
						createdAt: "2026-05-25T00:01:00.000Z",
						id: "mission-2",
						title: "Mission 2",
						updatedAt: "2026-05-25T00:01:00.000Z",
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

	it("restores a stored snapshot through getSnapshot", () => {
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
						title: "Mission 2",
						updatedAt: "2026-05-25T00:01:00.000Z",
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
					title: "Mission 1",
					updatedAt: "2026-05-25T00:00:00.000Z",
				},
				{
					createdAt: "2026-05-25T00:01:00.000Z",
					id: "mission-2",
					title: "Mission 2",
					updatedAt: "2026-05-25T00:01:00.000Z",
				},
			],
		});
	});
});
