import { SidebarActionButton } from "@/components/sidebar-action-button";
import { TextareaPanel } from "@/components/textarea-panel";
import { vscode } from "@/lib/vscode";
import { useEffect, useMemo, useState } from "react";

interface MissionWorkbenchCatalogEntry {
	fileName: string;
	name: string;
	ref: string;
	supported: boolean;
	unavailableReason: string | null;
}

interface MissionWorkbenchMission {
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

interface MissionWorkbenchState {
	mission: MissionWorkbenchMission | null;
	operations: {
		supported: MissionWorkbenchCatalogEntry[];
		unsupported: MissionWorkbenchCatalogEntry[];
	};
}

const EMPTY_STATE: MissionWorkbenchState = {
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

const getRuntimeStatusClassName = (
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

const getComposerStatusMessage = ({
	draft,
	mission,
	terminalActionLabel,
}: {
	draft: string;
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

const MISSION_STATUS_LABELS: Record<MissionWorkbenchMission["status"], string> =
	{
		active: "Active",
		draft: "Draft",
		error: "Delivery Error",
		sending: "Sending",
	};

const getMissionStatusClassName = (
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

const Route = () => {
	const [draft, setDraft] = useState("");
	const [pendingDelete, setPendingDelete] = useState(false);
	const [state, setState] = useState<MissionWorkbenchState>(EMPTY_STATE);

	useEffect(() => {
		const listener = (event: MessageEvent) => {
			const payload = event.data;
			if (payload?.command !== "ff15-mission-workbench.state") {
				return;
			}

			setState(payload.state ?? EMPTY_STATE);
		};

		window.addEventListener("message", listener);
		vscode.postMessage({ command: "ff15-mission-workbench.ready" });

		return () => {
			window.removeEventListener("message", listener);
		};
	}, []);

	const mission = state.mission;
	const selectedOperation = useMemo(() => {
		if (!mission?.operationRef) {
			return null;
		}

		return (
			state.operations.supported.find(
				(operation) => operation.ref === mission.operationRef
			) ??
			state.operations.unsupported.find(
				(operation) => operation.ref === mission.operationRef
			) ??
			null
		);
	}, [
		mission?.operationRef,
		state.operations.supported,
		state.operations.unsupported,
	]);
	const composerDisabled = mission === null;
	const retryingErroredMission = mission?.status === "error";
	const composerActionDisabled =
		composerDisabled ||
		draft.trim().length === 0 ||
		mission?.status === "sending";
	const composerActionLabel = retryingErroredMission
		? "Retry Delivery"
		: "Send to Noctis";
	const terminalActionLabel = mission?.sessionName
		? "Reopen Terminal"
		: "Launch Terminal";
	const runtimeStatusLabel = (() => {
		if (!mission?.operationRef) {
			return "Idle";
		}

		if (!mission.workflow.runtimeStatus) {
			return "Pending Probe";
		}

		return RUNTIME_STATUS_LABELS[mission.workflow.runtimeStatus];
	})();
	const probeVerdictLabel = (() => {
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
	})();
	const composerStatusMessage = getComposerStatusMessage({
		draft,
		mission,
		terminalActionLabel,
	});

	if (!mission) {
		return (
			<div className="mx-auto flex h-full max-w-4xl items-center justify-center px-6 py-6">
				<div className="rounded-3xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_74%,transparent)] px-6 py-6 text-center text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.7))] text-sm leading-6">
					Mission Workbench could not load this mission. Return to the Missions
					sidebar and select it again.
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto flex h-full max-w-6xl flex-col gap-5 px-6 py-5">
			<div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--vscode-editor-background)_92%,transparent),color-mix(in_srgb,var(--vscode-button-background,#0e7490)_16%,transparent))] px-5 py-4">
				<div className="flex min-w-0 flex-col gap-2">
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="font-semibold text-[color:var(--vscode-foreground)] text-xl tracking-[0.03em]">
							{mission.title}
						</h1>
						<span
							className={`w-fit rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.12em] ${getMissionStatusClassName(mission.status)}`}
						>
							{MISSION_STATUS_LABELS[mission.status]}
						</span>
					</div>
					<div className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] text-sm leading-6">
						<div>
							Mission Workbench is the primary operation-entry surface for this
							mission.
						</div>
						<div>
							Selected operation:{" "}
							{selectedOperation?.name ?? "None selected yet"}
						</div>
						<div>Session: {mission.sessionName ?? "Not attached yet"}</div>
						<div>Runtime: {runtimeStatusLabel}</div>
						<div>Probe verdict: {probeVerdictLabel}</div>
						<div>
							Current step: {mission.workflow.currentStep ?? "Not reported yet"}
						</div>
						<div>
							Active task: {mission.workflow.activeTask ?? "Not reported yet"}
						</div>
						<div>
							Workspace: {mission.workspaceRoot ?? "Workspace root unavailable"}
						</div>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<SidebarActionButton
						className="h-8 w-auto px-4 text-xs"
						onClick={() => {
							vscode.postMessage({
								command: "ff15-mission-workbench.open-terminal",
							});
						}}
					>
						{terminalActionLabel}
					</SidebarActionButton>
					<SidebarActionButton
						className="h-8 w-auto border border-[color:var(--vscode-errorForeground,#f87171)]/35 bg-transparent px-4 text-[color:var(--vscode-errorForeground,#f87171)] text-xs hover:bg-[color:var(--vscode-errorForeground,#f87171)]/12"
						onClick={() => {
							if (!pendingDelete) {
								setPendingDelete(true);
								return;
							}

							setPendingDelete(false);
							setDraft("");
							vscode.postMessage({
								command: "ff15-mission-workbench.delete",
							});
						}}
					>
						{pendingDelete ? "Confirm Delete" : "Delete Mission"}
					</SidebarActionButton>
				</div>
			</div>

			<div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
				<div className="flex min-h-0 flex-col gap-4">
					<div className="rounded-3xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_74%,transparent)] px-5 py-4">
						<div className="mb-2 font-semibold text-[color:var(--vscode-foreground)] text-sm uppercase tracking-[0.18em]">
							Mission Status
						</div>
						<div className="mb-3 flex flex-wrap items-center gap-2">
							<span
								className={`rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.12em] ${getRuntimeStatusClassName(mission.workflow.runtimeStatus)}`}
							>
								{runtimeStatusLabel}
							</span>
							<span className="rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_18%,transparent)] px-2 py-0.5 font-medium text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.12em]">
								Probe {probeVerdictLabel}
							</span>
						</div>
						<div className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] text-sm leading-6">
							{composerStatusMessage}
						</div>
						{mission.workflow.probe.summary ? (
							<div className="mt-3 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.64))] text-xs leading-5">
								{mission.workflow.probe.summary}
							</div>
						) : null}
					</div>

					<div className="min-h-0 flex-1">
						<TextareaPanel
							containerClassName=" px-0"
							disabled={composerDisabled}
							onChange={(event) => {
								setPendingDelete(false);
								setDraft(event.target.value);
							}}
							placeholder={`Draft a message for ${mission.title}...`}
							rows={10}
							textareaClassName="min-h-[16rem] px-5 text-sm leading-7"
							value={draft}
						>
							<div className="flex items-center justify-between gap-3 border-[color:color-mix(in_srgb,var(--vscode-foreground)_10%,transparent)] border-t px-5 pt-3">
								<div className="flex min-w-0 flex-col gap-1">
									<span
										className={`w-fit rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.12em] ${getMissionStatusClassName(mission.status)}`}
									>
										{MISSION_STATUS_LABELS[mission.status]}
									</span>
									<span className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
										{mission.lastError ??
											"Prompt delivery stays mission-scoped and preserves this workbench context."}
									</span>
								</div>
								<SidebarActionButton
									className="h-8 w-auto px-4 text-xs"
									disabled={composerActionDisabled}
									onClick={() => {
										if (draft.trim().length === 0) {
											return;
										}

										vscode.postMessage({
											command: retryingErroredMission
												? "ff15-mission-workbench.retry"
												: "ff15-mission-workbench.send",
											prompt: draft.trim(),
										});
									}}
								>
									{composerActionLabel}
								</SidebarActionButton>
							</div>
						</TextareaPanel>
					</div>
				</div>

				<div className="flex min-h-0 flex-col gap-4 rounded-3xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_74%,transparent)] px-5 py-4">
					<div>
						<div className="font-semibold text-[color:var(--vscode-foreground)] text-sm uppercase tracking-[0.18em]">
							Operations Catalog
						</div>
						<div className="mt-2 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] text-sm leading-6">
							Choose the bundled operation identity for this mission.
							Unsupported entries stay visible so compatibility is explicit.
						</div>
					</div>

					<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
						{state.operations.supported.map((operation) => {
							const selected = mission.operationRef === operation.ref;

							return (
								<button
									className={[
										"rounded-2xl border px-4 py-3 text-left transition-colors",
										selected
											? "border-[color:var(--vscode-button-background,#0e7490)] bg-[color:var(--vscode-button-background,#0e7490)]/12"
											: "border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_82%,transparent)] hover:bg-[color:var(--vscode-button-background,#0e7490)]/8",
									].join(" ")}
									key={operation.ref}
									onClick={() => {
										vscode.postMessage({
											command: "ff15-mission-workbench.select-operation",
											operationRef: operation.ref,
										});
									}}
									type="button"
								>
									<div className="flex items-center justify-between gap-3">
										<div className="font-medium text-[color:var(--vscode-foreground)] text-sm">
											{operation.name}
										</div>
										<span className="rounded-full border border-emerald-500/30 bg-emerald-500/12 px-2 py-0.5 font-medium text-[10px] text-emerald-200 uppercase tracking-[0.12em]">
											Selectable
										</span>
									</div>
									<div className="mt-2 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.68))] text-xs leading-5">
										Ref: {operation.ref}
									</div>
								</button>
							);
						})}

						{state.operations.unsupported.map((operation) => (
							<div
								className="rounded-2xl border border-[color:var(--vscode-errorForeground,#f87171)]/25 bg-[color:var(--vscode-errorForeground,#f87171)]/8 px-4 py-3"
								key={operation.ref}
							>
								<div className="flex items-center justify-between gap-3">
									<div className="font-medium text-[color:var(--vscode-foreground)] text-sm">
										{operation.name}
									</div>
									<span className="rounded-full border border-[color:var(--vscode-errorForeground,#f87171)]/35 bg-[color:var(--vscode-errorForeground,#f87171)]/12 px-2 py-0.5 font-medium text-[10px] text-[color:var(--vscode-errorForeground,#f87171)] uppercase tracking-[0.12em]">
										Unavailable
									</span>
								</div>
								<div className="mt-2 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.68))] text-xs leading-5">
									<div>Ref: {operation.ref}</div>
									<div>
										{operation.unavailableReason ??
											"Unavailable in the current roster or runtime scope."}
									</div>
								</div>
							</div>
						))}

						{state.operations.supported.length === 0 &&
						state.operations.unsupported.length === 0 ? (
							<div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_14%,transparent)] border-dashed px-4 py-5 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.7))] text-sm leading-6">
								Bundled operations have not been materialized for this workspace
								yet.
							</div>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
};

export default Route;
