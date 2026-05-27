import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { FF15_AGENT_IDS, type Ff15AgentId } from "../ff15-launch/launch-client";

export const FF15_MISSIONS_STATE_STORAGE_KEY =
	"multi-agent-ff15-vscode.missionsState";
export const FF15_WORKSPACE_RUNTIME_DIR_NAME = ".ff15";

const FF15_MISSIONS_DIR_NAME = "missions";
const FF15_MISSION_FILE_NAME = "mission.json";
const FF15_MISSION_SCHEMA_VERSION = 1;

export type Ff15MissionStatus = "active" | "draft" | "error" | "sending";
export type Ff15MissionAgentPanes = Record<Ff15AgentId, string | null>;
export type Ff15MissionWorkflowRuntimeStatus =
	| "ready"
	| "starting"
	| "unavailable";
export type Ff15MissionWorkflowProbeVerdict = "go" | "no-go";

export interface Ff15MissionWorkflowProbe {
	checkedAt: string | null;
	summary: string | null;
	verdict: Ff15MissionWorkflowProbeVerdict | null;
}

export interface Ff15MissionWorkflowState {
	activeTask: string | null;
	currentStep: string | null;
	lastReportSummary: string | null;
	probe: Ff15MissionWorkflowProbe;
	runtimeStatus: Ff15MissionWorkflowRuntimeStatus | null;
}

export interface Ff15MissionSummary {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	status: Ff15MissionStatus;
	sessionName: string | null;
	workspaceRoot: string | null;
	lastError: string | null;
}

export interface Ff15MissionRecord extends Ff15MissionSummary {
	agentPanes: Ff15MissionAgentPanes;
	operationRef: string | null;
	workflow: Ff15MissionWorkflowState;
	schemaVersion: 1;
}

export interface Ff15MissionsStoreSnapshot {
	activeMissionId: string | null;
	missions: Ff15MissionSummary[];
}

export interface Ff15MissionsStore {
	getSnapshot: () => Ff15MissionsStoreSnapshot;
	getMissionRecord: (missionId: string) => Ff15MissionRecord | null;
	createMission: () => Promise<Ff15MissionsStoreSnapshot>;
	deleteMission: (missionId: string) => Promise<Ff15MissionsStoreSnapshot>;
	selectMission: (missionId: string) => Promise<Ff15MissionsStoreSnapshot>;
	updateMission: (
		missionId: string,
		patch: Partial<
			Pick<
				Ff15MissionRecord,
				| "agentPanes"
				| "lastError"
				| "operationRef"
				| "sessionName"
				| "status"
				| "workflow"
				| "workspaceRoot"
			>
		>
	) => Promise<Ff15MissionsStoreSnapshot>;
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
	getWorkspaceRoot?: () => string | undefined;
}

export const createEmptyFf15MissionAgentPanes = (): Ff15MissionAgentPanes =>
	Object.fromEntries(
		FF15_AGENT_IDS.map((agentId) => [agentId, null])
	) as Ff15MissionAgentPanes;

export const createEmptyFf15MissionWorkflowState =
	(): Ff15MissionWorkflowState => ({
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

const normalizeMissionSummary = (
	mission: Ff15MissionSummary
): Ff15MissionSummary => ({
	...mission,
	lastError: typeof mission.lastError === "string" ? mission.lastError : null,
	sessionName:
		typeof mission.sessionName === "string" ? mission.sessionName : null,
	status:
		mission.status === "active" ||
		mission.status === "error" ||
		mission.status === "sending"
			? mission.status
			: "draft",
	workspaceRoot:
		typeof mission.workspaceRoot === "string" ? mission.workspaceRoot : null,
});

const normalizeAgentPanes = (value: unknown): Ff15MissionAgentPanes => {
	const normalized = createEmptyFf15MissionAgentPanes();

	if (!value || typeof value !== "object") {
		return normalized;
	}

	const agentPanes = value as Record<string, unknown>;
	for (const agentId of FF15_AGENT_IDS) {
		const paneId = agentPanes[agentId];
		normalized[agentId] =
			typeof paneId === "string" && paneId.length > 0 ? paneId : null;
	}

	return normalized;
};

const normalizeWorkflowProbe = (value: unknown): Ff15MissionWorkflowProbe => {
	if (!value || typeof value !== "object") {
		return createEmptyFf15MissionWorkflowState().probe;
	}

	const probe = value as Record<string, unknown>;
	return {
		checkedAt: typeof probe.checkedAt === "string" ? probe.checkedAt : null,
		summary: typeof probe.summary === "string" ? probe.summary : null,
		verdict:
			probe.verdict === "go" || probe.verdict === "no-go"
				? probe.verdict
				: null,
	};
};

const normalizeWorkflowState = (value: unknown): Ff15MissionWorkflowState => {
	if (!value || typeof value !== "object") {
		return createEmptyFf15MissionWorkflowState();
	}

	const workflow = value as Record<string, unknown>;
	return {
		activeTask:
			typeof workflow.activeTask === "string" ? workflow.activeTask : null,
		currentStep:
			typeof workflow.currentStep === "string" ? workflow.currentStep : null,
		lastReportSummary:
			typeof workflow.lastReportSummary === "string"
				? workflow.lastReportSummary
				: null,
		probe: normalizeWorkflowProbe(workflow.probe),
		runtimeStatus:
			workflow.runtimeStatus === "ready" ||
			workflow.runtimeStatus === "starting" ||
			workflow.runtimeStatus === "unavailable"
				? workflow.runtimeStatus
				: null,
	};
};

const normalizeMissionRecord = (value: unknown): Ff15MissionRecord | null => {
	if (!isMissionSummary(value)) {
		return null;
	}

	const mission = value as Ff15MissionSummary & {
		agentPanes?: unknown;
		operationRef?: unknown;
		schemaVersion?: unknown;
		workflow?: unknown;
	};

	return {
		...normalizeMissionSummary(mission),
		agentPanes: normalizeAgentPanes(mission.agentPanes),
		operationRef:
			typeof mission.operationRef === "string" ? mission.operationRef : null,
		workflow: normalizeWorkflowState(mission.workflow),
		schemaVersion: FF15_MISSION_SCHEMA_VERSION,
	};
};

const createMissionRecordFromSummary = (
	mission: Ff15MissionSummary,
	workspaceRoot: string | null = mission.workspaceRoot
): Ff15MissionRecord => ({
	...normalizeMissionSummary({
		...mission,
		workspaceRoot,
	}),
	agentPanes: createEmptyFf15MissionAgentPanes(),
	operationRef: null,
	workflow: createEmptyFf15MissionWorkflowState(),
	schemaVersion: FF15_MISSION_SCHEMA_VERSION,
});

const toMissionSummary = (mission: Ff15MissionRecord): Ff15MissionSummary => ({
	createdAt: mission.createdAt,
	id: mission.id,
	lastError: mission.lastError,
	sessionName: mission.sessionName,
	status: mission.status,
	title: mission.title,
	updatedAt: mission.updatedAt,
	workspaceRoot: mission.workspaceRoot,
});

const sortMissionRecords = (
	missionRecords: readonly Ff15MissionRecord[]
): Ff15MissionRecord[] =>
	[...missionRecords].sort((left, right) =>
		right.updatedAt.localeCompare(left.updatedAt)
	);

const normalizeSnapshot = (value: unknown): Ff15MissionsStoreSnapshot => {
	if (!value || typeof value !== "object") {
		return {
			activeMissionId: null,
			missions: [],
		};
	}

	const snapshot = value as Record<string, unknown>;
	const missions = Array.isArray(snapshot.missions)
		? snapshot.missions.filter(isMissionSummary).map(normalizeMissionSummary)
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

const getWorkspaceMissionsDir = (workspaceRoot: string): string =>
	join(workspaceRoot, FF15_WORKSPACE_RUNTIME_DIR_NAME, FF15_MISSIONS_DIR_NAME);

const getWorkspaceMissionFilePath = (
	workspaceRoot: string,
	missionId: string
): string =>
	join(
		getWorkspaceMissionsDir(workspaceRoot),
		missionId,
		FF15_MISSION_FILE_NAME
	);

const getWorkspaceMissionDir = (
	workspaceRoot: string,
	missionId: string
): string => join(getWorkspaceMissionsDir(workspaceRoot), missionId);

const persistMissionRecordToWorkspace = (
	workspaceRoot: string,
	mission: Ff15MissionRecord
) => {
	const missionFilePath = getWorkspaceMissionFilePath(
		workspaceRoot,
		mission.id
	);
	mkdirSync(getWorkspaceMissionDir(workspaceRoot, mission.id), {
		recursive: true,
	});
	writeFileSync(
		missionFilePath,
		`${JSON.stringify(mission, null, 2)}\n`,
		"utf8"
	);
};

const deleteMissionRecordFromWorkspace = (
	workspaceRoot: string,
	missionId: string
) => {
	rmSync(getWorkspaceMissionDir(workspaceRoot, missionId), {
		force: true,
		recursive: true,
	});
};

const loadMissionRecordsFromWorkspace = (
	workspaceRoot: string
): Ff15MissionRecord[] => {
	const missionsDir = getWorkspaceMissionsDir(workspaceRoot);
	if (!existsSync(missionsDir)) {
		return [];
	}

	const missionRecords = readdirSync(missionsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => {
			const missionFilePath = getWorkspaceMissionFilePath(
				workspaceRoot,
				entry.name
			);
			if (!existsSync(missionFilePath)) {
				return null;
			}

			try {
				const parsed = JSON.parse(readFileSync(missionFilePath, "utf8"));
				return normalizeMissionRecord(parsed);
			} catch {
				return null;
			}
		})
		.filter((mission): mission is Ff15MissionRecord => mission !== null)
		.map((mission) => ({
			...mission,
			workspaceRoot: mission.workspaceRoot ?? workspaceRoot,
		}));

	return sortMissionRecords(missionRecords);
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
	let missionRecords = snapshot.missions.map((mission) =>
		createMissionRecordFromSummary(mission)
	);

	const getActiveWorkspaceRoot = () => options.getWorkspaceRoot?.();

	const hydrateMissionRecords = (): Ff15MissionRecord[] => {
		const workspaceRoot = getActiveWorkspaceRoot();
		if (!workspaceRoot) {
			return missionRecords;
		}

		const persistedMissionRecords =
			loadMissionRecordsFromWorkspace(workspaceRoot);
		if (persistedMissionRecords.length > 0) {
			missionRecords = persistedMissionRecords;
			return missionRecords;
		}

		if (missionRecords.length === 0) {
			return missionRecords;
		}

		missionRecords = missionRecords.map((mission) => ({
			...mission,
			workspaceRoot: mission.workspaceRoot ?? workspaceRoot,
		}));

		for (const mission of missionRecords) {
			persistMissionRecordToWorkspace(workspaceRoot, mission);
		}

		return missionRecords;
	};

	const syncSnapshotFromMissionRecords = (): Ff15MissionsStoreSnapshot => {
		const hydratedMissionRecords = hydrateMissionRecords();
		const missions = hydratedMissionRecords.map(toMissionSummary);
		const activeMissionId =
			typeof snapshot.activeMissionId === "string" &&
			missions.some((mission) => mission.id === snapshot.activeMissionId)
				? snapshot.activeMissionId
				: null;

		snapshot = {
			activeMissionId,
			missions,
		};

		return snapshot;
	};

	const persistSnapshot = async (): Promise<Ff15MissionsStoreSnapshot> => {
		syncSnapshotFromMissionRecords();
		await storage.update(FF15_MISSIONS_STATE_STORAGE_KEY, snapshot);
		return snapshot;
	};

	const persistMissionRecord = (mission: Ff15MissionRecord) => {
		const workspaceRoot = getActiveWorkspaceRoot() ?? mission.workspaceRoot;
		if (!workspaceRoot) {
			return;
		}

		persistMissionRecordToWorkspace(workspaceRoot, {
			...mission,
			workspaceRoot,
		});
	};

	syncSnapshotFromMissionRecords();

	return {
		getSnapshot: () => syncSnapshotFromMissionRecords(),
		getMissionRecord: (missionId: string) =>
			hydrateMissionRecords().find((mission) => mission.id === missionId) ??
			null,
		createMission: () => {
			hydrateMissionRecords();
			const createdAt = getNow();
			const missionNumber = missionRecords.length + 1;
			const workspaceRoot = getActiveWorkspaceRoot() ?? null;
			const mission = {
				createdAt,
				id: createId(),
				lastError: null,
				operationRef: null,
				sessionName: null,
				status: "draft",
				title: `Mission ${missionNumber}`,
				updatedAt: createdAt,
				workspaceRoot,
				agentPanes: createEmptyFf15MissionAgentPanes(),
				workflow: createEmptyFf15MissionWorkflowState(),
				schemaVersion: FF15_MISSION_SCHEMA_VERSION,
			} satisfies Ff15MissionRecord;

			missionRecords = [mission, ...missionRecords];
			snapshot = {
				...snapshot,
				activeMissionId: mission.id,
			};
			persistMissionRecord(mission);

			return persistSnapshot();
		},
		deleteMission: (missionId: string) => {
			hydrateMissionRecords();
			const deletedMission = missionRecords.find(
				(mission) => mission.id === missionId
			);
			if (!deletedMission) {
				return Promise.resolve(syncSnapshotFromMissionRecords());
			}

			missionRecords = missionRecords.filter(
				(mission) => mission.id !== missionId
			);

			const workspaceRoot =
				getActiveWorkspaceRoot() ?? deletedMission.workspaceRoot;
			if (workspaceRoot) {
				deleteMissionRecordFromWorkspace(workspaceRoot, missionId);
			}

			snapshot = {
				...snapshot,
				activeMissionId:
					snapshot.activeMissionId === missionId
						? (missionRecords[0]?.id ?? null)
						: snapshot.activeMissionId,
			};

			return persistSnapshot();
		},
		selectMission: (missionId: string) => {
			syncSnapshotFromMissionRecords();
			if (!snapshot.missions.some((mission) => mission.id === missionId)) {
				return Promise.resolve(snapshot);
			}

			snapshot = {
				...snapshot,
				activeMissionId: missionId,
			};

			return persistSnapshot();
		},
		updateMission: (missionId, patch) => {
			hydrateMissionRecords();
			const updatedAt = getNow();
			let didUpdate = false;

			missionRecords = missionRecords.map((mission) => {
				if (mission.id !== missionId) {
					return mission;
				}

				didUpdate = true;
				const updatedMission: Ff15MissionRecord = {
					...mission,
					...patch,
					agentPanes: patch.agentPanes
						? normalizeAgentPanes(patch.agentPanes)
						: mission.agentPanes,
					workflow: patch.workflow
						? normalizeWorkflowState(patch.workflow)
						: mission.workflow,
					updatedAt,
					workspaceRoot:
						patch.workspaceRoot ??
						mission.workspaceRoot ??
						getActiveWorkspaceRoot() ??
						null,
				};

				persistMissionRecord(updatedMission);
				return updatedMission;
			});

			if (!didUpdate) {
				return Promise.resolve(syncSnapshotFromMissionRecords());
			}

			return persistSnapshot();
		},
	};
};
