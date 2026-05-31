export interface MissionWorkbenchCatalogEntry {
	fileName: string;
	name: string;
	ref: string;
	supported: boolean;
	unavailableReason: string | null;
}

export interface MissionWorkbenchMission {
	id: string;
	lastError: string | null;
	operationRef: string | null;
	sessionName: string | null;
	status: "active" | "draft" | "error" | "sending";
	title: string;
	workflow: {
		activeTask: string | null;
		currentStep: string | null;
		lastReportSummary: string | null;
		probe: {
			checkedAt: string | null;
			summary: string | null;
			verdict: "go" | "no-go" | null;
		};
		runtimeStatus: "ready" | "starting" | "unavailable" | null;
	};
	workspaceRoot: string | null;
}

export interface MissionWorkbenchState {
	mission: MissionWorkbenchMission | null;
	operations: {
		supported: MissionWorkbenchCatalogEntry[];
		unsupported: MissionWorkbenchCatalogEntry[];
	};
}

export const EMPTY_STATE: MissionWorkbenchState = {
	mission: null,
	operations: {
		supported: [],
		unsupported: [],
	},
};

const RUNTIME_STATUS_LABELS = {
	ready: "Ready",
	starting: "Starting",
	unavailable: "Unavailable",
} as const;

export const OPERATION_REQUIRED_MESSAGE =
	"Choose a supported operation to unlock prompt delivery to Noctis.";

export const MISSION_STATUS_LABELS: Record<
	MissionWorkbenchMission["status"],
	string
> = {
	active: "Active",
	draft: "Draft",
	error: "Delivery Error",
	sending: "Sending",
};

export const getRuntimeStatusClassName = (
	status: MissionWorkbenchMission["workflow"]["runtimeStatus"]
) => {
	if (status === "ready") {
		return "border-emerald-500/30 bg-emerald-500/12 text-emerald-200";
	}

	if (status === "starting") {
		return "border-amber-400/35 bg-amber-400/12 text-amber-100";
	}

	if (status === "unavailable") {
		return "border-[color:var(--vscode-errorForeground,#f87171)]/35 bg-[color:var(--vscode-errorForeground,#f87171)]/12 text-[color:var(--vscode-errorForeground,#f87171)]";
	}

	return "border-[color:color-mix(in_srgb,var(--vscode-foreground)_18%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_82%,transparent)] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))]";
};

export const getMissionStatusClassName = (
	status: MissionWorkbenchMission["status"]
) => {
	switch (status) {
		case "active":
			return "border-emerald-500/30 bg-emerald-500/12 text-emerald-200";
		case "error":
			return "border-[color:var(--vscode-errorForeground,#f87171)]/35 bg-[color:var(--vscode-errorForeground,#f87171)]/12 text-[color:var(--vscode-errorForeground,#f87171)]";
		case "sending":
			return "border-amber-400/35 bg-amber-400/12 text-amber-100";
		default:
			return "border-[color:color-mix(in_srgb,var(--vscode-foreground)_18%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_82%,transparent)] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))]";
	}
};

export const getComposerStatusMessage = ({
	draft,
	hasDeliverableOperation,
	mission,
	terminalActionLabel,
}: {
	draft: string;
	hasDeliverableOperation: boolean;
	mission: MissionWorkbenchMission | null;
	terminalActionLabel: string;
}) => {
	const getRuntimeProbeMessage = (activeMission: MissionWorkbenchMission) => {
		if (
			activeMission.operationRef &&
			activeMission.workflow.runtimeStatus === "starting"
		) {
			return "Starting the extension-owned operation runtime probe and validating local bridge scripts...";
		}

		if (
			activeMission.operationRef &&
			activeMission.workflow.runtimeStatus === "ready"
		) {
			return activeMission.workflow.lastReportSummary
				? `Operation runtime ready. ${activeMission.workflow.lastReportSummary}`
				: "Operation runtime ready. Local bridge scripts can now call the extension-owned runtime entry points.";
		}

		if (
			activeMission.operationRef &&
			activeMission.workflow.runtimeStatus === "unavailable"
		) {
			return (
				activeMission.workflow.probe.summary ??
				"The extension-owned runtime probe is unavailable for this mission."
			);
		}

		return null;
	};

	if (!mission) {
		return "Mission context is unavailable.";
	}

	if (!hasDeliverableOperation) {
		return draft.trim().length > 0
			? "Choose a supported operation before sending this message to Noctis."
			: OPERATION_REQUIRED_MESSAGE;
	}

	if (mission.lastError) {
		return draft.trim().length > 0
			? `${mission.lastError} Use Retry Delivery to resend from the same mission context.`
			: `${mission.lastError} Enter a message to retry delivery from the same mission.`;
	}

	if (mission.status === "sending") {
		return `Launching or attaching ${mission.title} and delivering the prompt...`;
	}

	if (mission.status === "active") {
		return `${mission.title} is active in ${mission.sessionName ?? "the mission session"}. Use ${terminalActionLabel} to focus its external window.`;
	}

	const runtimeProbeMessage = getRuntimeProbeMessage(mission);
	if (runtimeProbeMessage) {
		return runtimeProbeMessage;
	}

	return `Choose an operation, then use ${terminalActionLabel} whenever you want the visible mission terminal.`;
};

export const normalizeOperationQuery = (value: string): string =>
	value.trim().toLowerCase();

export const matchesOperationQuery = (
	operation: MissionWorkbenchCatalogEntry,
	query: string
) => {
	if (query.length === 0) {
		return true;
	}

	return [
		operation.name,
		operation.ref,
		operation.fileName,
		operation.unavailableReason ?? "",
	]
		.join("\n")
		.toLowerCase()
		.includes(query);
};

export const getRuntimeStatusLabel = (
	mission: MissionWorkbenchMission | null
): string => {
	if (!mission?.operationRef) {
		return "Idle";
	}

	if (!mission.workflow.runtimeStatus) {
		return "Pending Probe";
	}

	return RUNTIME_STATUS_LABELS[mission.workflow.runtimeStatus];
};

export const getProbeVerdictLabel = (
	mission: MissionWorkbenchMission | null
): string => {
	if (!mission?.operationRef) {
		return "Not started";
	}

	if (mission.workflow.probe.verdict === "go") {
		return "Go";
	}

	if (mission.workflow.probe.verdict === "no-go") {
		return "No-Go";
	}

	return "Pending";
};
