export const FF15_MISSIONS_STATE_STORAGE_KEY =
	"multi-agent-ff15-vscode.missionsState";

export interface Ff15MissionSummary {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
}

export interface Ff15MissionsStoreSnapshot {
	activeMissionId: string | null;
	missions: Ff15MissionSummary[];
}

export interface Ff15MissionsStore {
	getSnapshot: () => Ff15MissionsStoreSnapshot;
	createMission: () => Promise<Ff15MissionsStoreSnapshot>;
	selectMission: (missionId: string) => Promise<Ff15MissionsStoreSnapshot>;
}

interface Ff15MissionsStateStorage {
	get: <T>(key: string) => T | undefined;
	update: (
		key: string,
		value: Ff15MissionsStoreSnapshot
	) => PromiseLike<unknown>;
}

interface CreateWorkspaceStateFf15MissionsStoreOptions {
	createId?: () => string;
	getNow?: () => string;
}

const isMissionSummary = (value: unknown): value is Ff15MissionSummary => {
	if (!value || typeof value !== "object") {
		return false;
	}

	const mission = value as Record<string, unknown>;
	return (
		typeof mission.id === "string" &&
		typeof mission.title === "string" &&
		typeof mission.createdAt === "string" &&
		typeof mission.updatedAt === "string"
	);
};

const normalizeSnapshot = (value: unknown): Ff15MissionsStoreSnapshot => {
	if (!value || typeof value !== "object") {
		return {
			activeMissionId: null,
			missions: [],
		};
	}

	const snapshot = value as Record<string, unknown>;
	const missions = Array.isArray(snapshot.missions)
		? snapshot.missions.filter(isMissionSummary)
		: [];
	const activeMissionId =
		typeof snapshot.activeMissionId === "string" &&
		missions.some((mission) => mission.id === snapshot.activeMissionId)
			? snapshot.activeMissionId
			: null;

	return {
		activeMissionId,
		missions,
	};
};

export const createWorkspaceStateFf15MissionsStore = (
	storage: Ff15MissionsStateStorage,
	options: CreateWorkspaceStateFf15MissionsStoreOptions = {}
): Ff15MissionsStore => {
	const createId = options.createId ?? (() => crypto.randomUUID());
	const getNow = options.getNow ?? (() => new Date().toISOString());
	let snapshot = normalizeSnapshot(
		storage.get<Ff15MissionsStoreSnapshot>(FF15_MISSIONS_STATE_STORAGE_KEY)
	);

	const persistSnapshot = async (): Promise<Ff15MissionsStoreSnapshot> => {
		await storage.update(FF15_MISSIONS_STATE_STORAGE_KEY, snapshot);
		return snapshot;
	};

	return {
		getSnapshot: () => snapshot,
		createMission: () => {
			const createdAt = getNow();
			const missionNumber = snapshot.missions.length + 1;
			const mission = {
				createdAt,
				id: createId(),
				title: `Mission ${missionNumber}`,
				updatedAt: createdAt,
			};

			snapshot = {
				activeMissionId: mission.id,
				missions: [mission, ...snapshot.missions],
			};

			return persistSnapshot();
		},
		selectMission: (missionId: string) => {
			if (!snapshot.missions.some((mission) => mission.id === missionId)) {
				return Promise.resolve(snapshot);
			}

			snapshot = {
				...snapshot,
				activeMissionId: missionId,
			};

			return persistSnapshot();
		},
	};
};
