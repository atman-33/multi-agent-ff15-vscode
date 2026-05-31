import { SidebarActionButton } from "@/components/sidebar-action-button";
import { TextareaPanel } from "@/components/textarea-panel";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { vscode } from "@/lib/vscode";
import { SearchIcon } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

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
	terminalReady: boolean;
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

const OPERATION_REQUIRED_MESSAGE =
	"Choose a supported operation to unlock prompt delivery to Noctis.";
const TERMINAL_REQUIRED_MESSAGE =
	"Launch Terminal before sending a prompt to Noctis.";

const MISSION_STATUS_LABELS: Record<MissionWorkbenchMission["status"], string> =
	{
		active: "Active",
		draft: "Draft",
		error: "Delivery Error",
		sending: "Sending",
	};

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

const getComposerStatusMessage = ({
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

	if (!mission.terminalReady) {
		return `${terminalActionLabel} before sending a message to Noctis.`;
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

const normalizeOperationQuery = (value: string): string =>
	value.trim().toLowerCase();

const matchesOperationQuery = (
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

const getRuntimeStatusLabel = (
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

const getProbeVerdictLabel = (
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

const renderMissionStatusSupplement = (mission: MissionWorkbenchMission) => {
	if (mission.lastError) {
		return (
			<div className="mt-3 rounded-2xl border border-[color:var(--vscode-errorForeground,#f87171)]/35 bg-[color:var(--vscode-errorForeground,#f87171)]/10 px-4 py-3 text-[color:var(--vscode-errorForeground,#f87171)] text-sm leading-6">
				{mission.lastError}
			</div>
		);
	}

	if (!mission.workflow.probe.summary) {
		return null;
	}

	return (
		<div className="mt-3 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.64))] text-xs leading-5">
			{mission.workflow.probe.summary}
		</div>
	);
};

interface MissionWorkbenchHeaderProps {
	mission: MissionWorkbenchMission;
	onConfirmDelete: () => void;
	onOpenTerminal: () => void;
	pendingDelete: boolean;
	probeVerdictLabel: string;
	runtimeStatusLabel: string;
	selectedOperation: MissionWorkbenchCatalogEntry | null;
	terminalActionLabel: string;
}

const MissionWorkbenchHeader = ({
	mission,
	onConfirmDelete,
	onOpenTerminal,
	pendingDelete,
	probeVerdictLabel,
	runtimeStatusLabel,
	selectedOperation,
	terminalActionLabel,
}: MissionWorkbenchHeaderProps) => (
	<div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--vscode-editor-background)_92%,transparent),color-mix(in_srgb,var(--vscode-button-background,#0e7490)_16%,transparent))] px-5 py-4">
		<div className="flex min-w-0 flex-1 flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<h1 className="font-semibold text-[color:var(--vscode-foreground)] text-xl tracking-[0.03em]">
					{mission.title}
				</h1>
				<span
					className={`w-fit rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.12em] ${getMissionStatusClassName(mission.status)}`}
				>
					{MISSION_STATUS_LABELS[mission.status]}
				</span>
				<span
					className={`w-fit rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.12em] ${getRuntimeStatusClassName(mission.workflow.runtimeStatus)}`}
				>
					Runtime {runtimeStatusLabel}
				</span>
			</div>
			<div className="flex flex-wrap gap-2 text-[11px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.12em]">
				<span className="rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_16%,transparent)] px-2.5 py-1">
					Operation {selectedOperation?.name ?? "Choose below"}
				</span>
				<span className="rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_16%,transparent)] px-2.5 py-1">
					Session {mission.terminalReady ? "Attached" : "Not attached"}
				</span>
				<span className="rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_16%,transparent)] px-2.5 py-1">
					Probe {probeVerdictLabel}
				</span>
			</div>
			<Accordion
				className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_10%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_64%,transparent)] px-4"
				type="multiple"
			>
				<AccordionItem className="border-none" value="mission-details">
					<AccordionTrigger className="py-3 text-[11px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.16em] hover:no-underline">
						Mission Details
					</AccordionTrigger>
					<AccordionContent className="grid gap-3 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.76))] text-sm leading-6">
						<div className="grid gap-1">
							<div className="text-[10px] uppercase tracking-[0.14em]">
								Selected Operation Ref
							</div>
							<div className="break-all font-medium text-[color:var(--vscode-foreground)]">
								{selectedOperation?.ref ?? "None selected yet"}
							</div>
						</div>
						<div className="grid gap-1 sm:grid-cols-2 sm:gap-3">
							<div>
								<div className="text-[10px] uppercase tracking-[0.14em]">
									Current Step
								</div>
								<div>{mission.workflow.currentStep ?? "Not reported yet"}</div>
							</div>
							<div>
								<div className="text-[10px] uppercase tracking-[0.14em]">
									Active Task
								</div>
								<div>{mission.workflow.activeTask ?? "Not reported yet"}</div>
							</div>
						</div>
						<div className="grid gap-1">
							<div className="text-[10px] uppercase tracking-[0.14em]">
								Workspace
							</div>
							<div className="break-all">
								{mission.workspaceRoot ?? "Workspace root unavailable"}
							</div>
						</div>
					</AccordionContent>
				</AccordionItem>
				<AccordionItem className="border-none" value="runtime-notes">
					<AccordionTrigger className="py-3 text-[11px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.16em] hover:no-underline">
						Runtime Notes
					</AccordionTrigger>
					<AccordionContent className="grid gap-3 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.76))] text-sm leading-6">
						<div>
							<div className="text-[10px] uppercase tracking-[0.14em]">
								Probe Summary
							</div>
							<div>
								{mission.workflow.probe.summary ??
									"No probe summary reported yet."}
							</div>
						</div>
						<div>
							<div className="text-[10px] uppercase tracking-[0.14em]">
								Last Report Summary
							</div>
							<div>
								{mission.workflow.lastReportSummary ??
									"No report summary captured yet."}
							</div>
						</div>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
		<div className="flex flex-wrap items-center gap-2">
			<SidebarActionButton
				className="h-8 w-auto px-4 text-xs"
				onClick={onOpenTerminal}
			>
				{terminalActionLabel}
			</SidebarActionButton>
			<SidebarActionButton
				className="h-8 w-auto border border-[color:var(--vscode-errorForeground,#f87171)]/35 bg-transparent px-4 text-[color:var(--vscode-errorForeground,#f87171)] text-xs hover:bg-[color:var(--vscode-errorForeground,#f87171)]/12"
				onClick={onConfirmDelete}
			>
				{pendingDelete ? "Confirm Delete" : "Delete Mission"}
			</SidebarActionButton>
		</div>
	</div>
);

interface SupportedOperationButtonProps {
	onSelect: (operationRef: string) => void;
	operation: MissionWorkbenchCatalogEntry;
	selected: boolean;
}

const SupportedOperationButton = ({
	onSelect,
	operation,
	selected,
}: SupportedOperationButtonProps) => (
	<button
		className={cn(
			"rounded-2xl border px-4 py-3 text-left transition-colors",
			selected
				? "border-[color:var(--vscode-button-background,#0e7490)] bg-[color:var(--vscode-button-background,#0e7490)]/12"
				: "border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_82%,transparent)] hover:bg-[color:var(--vscode-button-background,#0e7490)]/8"
		)}
		onClick={() => {
			onSelect(operation.ref);
		}}
		type="button"
	>
		<div className="flex items-start justify-between gap-3">
			<div className="min-w-0">
				<div className="truncate font-medium text-[color:var(--vscode-foreground)] text-sm">
					{operation.name}
				</div>
				<div className="mt-1 break-all text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.68))] text-xs leading-5">
					Ref: {operation.ref}
				</div>
			</div>
			{selected ? (
				<span className="rounded-full border border-emerald-500/30 bg-emerald-500/12 px-2 py-0.5 font-medium text-[10px] text-emerald-200 uppercase tracking-[0.12em]">
					Selected
				</span>
			) : null}
		</div>
	</button>
);

const UnsupportedOperationCard = ({
	operation,
}: {
	operation: MissionWorkbenchCatalogEntry;
}) => (
	<div className="rounded-2xl border border-[color:var(--vscode-errorForeground,#f87171)]/25 bg-[color:var(--vscode-errorForeground,#f87171)]/8 px-4 py-3">
		<div className="font-medium text-[color:var(--vscode-foreground)] text-sm">
			{operation.name}
		</div>
		<div className="mt-1 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.68))] text-xs leading-5">
			<div>Ref: {operation.ref}</div>
			<div>
				{operation.unavailableReason ??
					"Unavailable in the current roster or runtime scope."}
			</div>
		</div>
	</div>
);

interface OperationCatalogPanelProps {
	filteredSupportedOperations: MissionWorkbenchCatalogEntry[];
	filteredUnsupportedOperations: MissionWorkbenchCatalogEntry[];
	hasCatalogEntries: boolean;
	hasDeliverableOperation: boolean;
	hasOperationSearchResults: boolean;
	hasUnsupportedOperations: boolean;
	onOperationQueryChange: (value: string) => void;
	onSelectOperation: (operationRef: string) => void;
	operationQuery: string;
	selectedOperation: MissionWorkbenchCatalogEntry | null;
	selectedOperationRef: string | null;
	supportedOperationCount: number;
}

const OperationCatalogPanel = ({
	filteredSupportedOperations,
	filteredUnsupportedOperations,
	hasCatalogEntries,
	hasDeliverableOperation,
	hasOperationSearchResults,
	hasUnsupportedOperations,
	onOperationQueryChange,
	onSelectOperation,
	operationQuery,
	selectedOperation,
	selectedOperationRef,
	supportedOperationCount,
}: OperationCatalogPanelProps) => (
	<div className="flex flex-col gap-4 rounded-3xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_74%,transparent)] px-5 py-4">
		<div className="flex flex-wrap items-start justify-between gap-3">
			<div>
				<div className="font-semibold text-[color:var(--vscode-foreground)] text-sm uppercase tracking-[0.18em]">
					Operations Catalog
				</div>
				<div className="mt-2 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] text-sm leading-6">
					Choose a supported operation before sending a prompt to Noctis. Search
					keeps large catalogs manageable and unsupported entries stay collapsed
					until needed.
				</div>
			</div>
			<span className="rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_16%,transparent)] px-2.5 py-1 font-medium text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.12em]">
				{supportedOperationCount} Selectable
			</span>
		</div>

		<div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_10%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_68%,transparent)] px-4 py-3">
			<div className="text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.68))] uppercase tracking-[0.14em]">
				Selected Operation
			</div>
			<div className="mt-2 flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="truncate font-medium text-[color:var(--vscode-foreground)] text-sm">
						{selectedOperation?.name ?? "Choose an operation below"}
					</div>
					<div className="mt-1 break-all text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.68))] text-xs leading-5">
						{selectedOperation?.ref ?? OPERATION_REQUIRED_MESSAGE}
					</div>
				</div>
				<span
					className={cn(
						"rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.12em]",
						hasDeliverableOperation
							? "border-emerald-500/30 bg-emerald-500/12 text-emerald-200"
							: "border-[color:var(--vscode-warningForeground,#fbbf24)]/35 bg-[color:var(--vscode-warningForeground,#fbbf24)]/12 text-[color:var(--vscode-warningForeground,#fbbf24)]"
					)}
				>
					{hasDeliverableOperation ? "Ready" : "Required"}
				</span>
			</div>
		</div>

		<div className="relative">
			<SearchIcon className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.5))]" />
			<Input
				aria-label="Search operations"
				className="border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_82%,transparent)] pl-9 text-[color:var(--vscode-foreground)]"
				onChange={(event) => {
					onOperationQueryChange(event.target.value);
				}}
				placeholder="Search operations by name, ref, or file"
				value={operationQuery}
			/>
		</div>

		{hasCatalogEntries ? (
			<div className="grid gap-3">
				{hasOperationSearchResults ? (
					<div className="max-h-[18rem] overflow-y-auto pr-1">
						<div className="grid gap-2">
							{filteredSupportedOperations.map((operation) => (
								<SupportedOperationButton
									key={operation.ref}
									onSelect={onSelectOperation}
									operation={operation}
									selected={selectedOperationRef === operation.ref}
								/>
							))}
						</div>
					</div>
				) : (
					<div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_14%,transparent)] border-dashed px-4 py-5 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.7))] text-sm leading-6">
						No operations match "{operationQuery.trim()}".
					</div>
				)}

				{hasUnsupportedOperations ? (
					<Accordion
						className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_10%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_68%,transparent)] px-4"
						collapsible
						type="single"
					>
						<AccordionItem
							className="border-none"
							value="unsupported-operations"
						>
							<AccordionTrigger className="py-3 text-[11px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.16em] hover:no-underline">
								Unsupported Operations ({filteredUnsupportedOperations.length})
							</AccordionTrigger>
							<AccordionContent className="grid gap-2">
								{filteredUnsupportedOperations.length > 0 ? (
									filteredUnsupportedOperations.map((operation) => (
										<UnsupportedOperationCard
											key={operation.ref}
											operation={operation}
										/>
									))
								) : (
									<div className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.7))] text-sm leading-6">
										No unsupported entries match the current search.
									</div>
								)}
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				) : null}
			</div>
		) : (
			<div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_14%,transparent)] border-dashed px-4 py-5 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.7))] text-sm leading-6">
				Bundled operations have not been materialized for this workspace yet.
			</div>
		)}
	</div>
);

interface PromptComposerPanelProps {
	composerActionDisabled: boolean;
	composerActionLabel: string;
	composerDisabled: boolean;
	composerPlaceholder: string;
	draft: string;
	hasDeliverableOperation: boolean;
	mission: MissionWorkbenchMission;
	onDraftChange: (value: string) => void;
	onSend: () => void;
}

const PromptComposerPanel = ({
	composerActionDisabled,
	composerActionLabel,
	composerDisabled,
	composerPlaceholder,
	draft,
	hasDeliverableOperation,
	mission,
	onDraftChange,
	onSend,
}: PromptComposerPanelProps) => {
	let footerMessage = OPERATION_REQUIRED_MESSAGE;
	if (hasDeliverableOperation) {
		footerMessage = mission.terminalReady
			? (mission.lastError ??
				"Prompt delivery stays mission-scoped and preserves this workbench context.")
			: TERMINAL_REQUIRED_MESSAGE;
	}

	let statusBadgeLabel = "Operation Required";
	if (hasDeliverableOperation) {
		statusBadgeLabel = mission.terminalReady
			? MISSION_STATUS_LABELS[mission.status]
			: "Launch Required";
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div>
				<div className="font-semibold text-[color:var(--vscode-foreground)] text-sm uppercase tracking-[0.18em]">
					Prompt Composer
				</div>
				<div className="mt-2 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] text-sm leading-6">
					Write the message after choosing an operation. Delivery stays
					mission-scoped and runs through the selected operation context.
				</div>
			</div>

			<div className="min-h-0 flex-1">
				<TextareaPanel
					containerClassName=" px-0"
					disabled={composerDisabled}
					onChange={(event) => {
						onDraftChange(event.target.value);
					}}
					placeholder={composerPlaceholder}
					rows={10}
					textareaClassName="min-h-[16rem] px-5 text-sm leading-7"
					value={draft}
				>
					<div className="flex items-center justify-between gap-3 border-[color:color-mix(in_srgb,var(--vscode-foreground)_10%,transparent)] border-t px-5 pt-3">
						<div className="flex min-w-0 flex-col gap-1">
							<span
								className={cn(
									"w-fit rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.12em]",
									hasDeliverableOperation && mission.terminalReady
										? "border-emerald-500/30 bg-emerald-500/12 text-emerald-200"
										: "border-[color:var(--vscode-warningForeground,#fbbf24)]/35 bg-[color:var(--vscode-warningForeground,#fbbf24)]/12 text-[color:var(--vscode-warningForeground,#fbbf24)]"
								)}
							>
								{statusBadgeLabel}
							</span>
							<span className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
								{footerMessage}
							</span>
						</div>
						<SidebarActionButton
							className="h-8 w-auto px-4 text-xs"
							disabled={composerActionDisabled}
							onClick={onSend}
						>
							{composerActionLabel}
						</SidebarActionButton>
					</div>
				</TextareaPanel>
			</div>
		</div>
	);
};

const MissionStatusPanel = ({
	composerStatusMessage,
	mission,
	probeVerdictLabel,
	runtimeStatusLabel,
}: {
	composerStatusMessage: string;
	mission: MissionWorkbenchMission;
	probeVerdictLabel: string;
	runtimeStatusLabel: string;
}) => (
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
		{renderMissionStatusSupplement(mission)}
	</div>
);

const Route = () => {
	const [draft, setDraft] = useState("");
	const [operationQuery, setOperationQuery] = useState("");
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
	const deferredOperationQuery = useDeferredValue(
		normalizeOperationQuery(operationQuery)
	);
	const filteredSupportedOperations = useMemo(
		() =>
			state.operations.supported.filter((operation) =>
				matchesOperationQuery(operation, deferredOperationQuery)
			),
		[deferredOperationQuery, state.operations.supported]
	);
	const filteredUnsupportedOperations = useMemo(
		() =>
			state.operations.unsupported.filter((operation) =>
				matchesOperationQuery(operation, deferredOperationQuery)
			),
		[deferredOperationQuery, state.operations.unsupported]
	);
	const hasDeliverableOperation = Boolean(
		mission?.operationRef &&
			state.operations.supported.some(
				(operation) => operation.ref === mission.operationRef
			)
	);
	const composerDisabled = mission === null;
	const retryingErroredMission = mission?.status === "error";
	const composerActionDisabled =
		composerDisabled ||
		!hasDeliverableOperation ||
		!mission?.terminalReady ||
		draft.trim().length === 0 ||
		mission?.status === "sending";
	const composerActionLabel = retryingErroredMission
		? "Retry Delivery"
		: "Send to Noctis";
	const terminalActionLabel = mission?.terminalReady
		? "Reopen Terminal"
		: "Launch Terminal";
	const runtimeStatusLabel = getRuntimeStatusLabel(mission);
	const probeVerdictLabel = getProbeVerdictLabel(mission);
	const composerStatusMessage = getComposerStatusMessage({
		draft,
		hasDeliverableOperation,
		mission,
		terminalActionLabel,
	});
	let composerPlaceholder =
		"Choose a supported operation before drafting a delivery for Noctis.";
	if (hasDeliverableOperation) {
		composerPlaceholder = mission?.terminalReady
			? `Draft a message for ${mission?.title ?? "this mission"}...`
			: "Launch Terminal before sending a delivery to Noctis.";
	}
	const hasCatalogEntries =
		state.operations.supported.length > 0 ||
		state.operations.unsupported.length > 0;
	const hasOperationSearchResults =
		filteredSupportedOperations.length > 0 ||
		filteredUnsupportedOperations.length > 0;
	const hasUnsupportedOperations = state.operations.unsupported.length > 0;

	const handleOpenTerminal = () => {
		vscode.postMessage({ command: "ff15-mission-workbench.open-terminal" });
	};

	const handleConfirmDelete = () => {
		if (!pendingDelete) {
			setPendingDelete(true);
			return;
		}

		setPendingDelete(false);
		setDraft("");
		vscode.postMessage({ command: "ff15-mission-workbench.delete" });
	};

	const handleOperationQueryChange = (value: string) => {
		setOperationQuery(value);
		setPendingDelete(false);
	};

	const handleSelectOperation = (operationRef: string) => {
		vscode.postMessage({
			command: "ff15-mission-workbench.select-operation",
			operationRef,
		});
	};

	const handleDraftChange = (value: string) => {
		setPendingDelete(false);
		setDraft(value);
	};

	const handleSend = () => {
		if (draft.trim().length === 0) {
			return;
		}

		vscode.postMessage({
			command: retryingErroredMission
				? "ff15-mission-workbench.retry"
				: "ff15-mission-workbench.send",
			prompt: draft.trim(),
		});
	};

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
			<MissionWorkbenchHeader
				mission={mission}
				onConfirmDelete={handleConfirmDelete}
				onOpenTerminal={handleOpenTerminal}
				pendingDelete={pendingDelete}
				probeVerdictLabel={probeVerdictLabel}
				runtimeStatusLabel={runtimeStatusLabel}
				selectedOperation={selectedOperation}
				terminalActionLabel={terminalActionLabel}
			/>

			<div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)]">
				<div className="flex min-h-0 flex-col gap-4">
					<OperationCatalogPanel
						filteredSupportedOperations={filteredSupportedOperations}
						filteredUnsupportedOperations={filteredUnsupportedOperations}
						hasCatalogEntries={hasCatalogEntries}
						hasDeliverableOperation={hasDeliverableOperation}
						hasOperationSearchResults={hasOperationSearchResults}
						hasUnsupportedOperations={hasUnsupportedOperations}
						onOperationQueryChange={handleOperationQueryChange}
						onSelectOperation={handleSelectOperation}
						operationQuery={operationQuery}
						selectedOperation={selectedOperation}
						selectedOperationRef={mission.operationRef}
						supportedOperationCount={state.operations.supported.length}
					/>

					<PromptComposerPanel
						composerActionDisabled={composerActionDisabled}
						composerActionLabel={composerActionLabel}
						composerDisabled={composerDisabled}
						composerPlaceholder={composerPlaceholder}
						draft={draft}
						hasDeliverableOperation={hasDeliverableOperation}
						mission={mission}
						onDraftChange={handleDraftChange}
						onSend={handleSend}
					/>
				</div>

				<div className="flex min-h-0 flex-col gap-4">
					<MissionStatusPanel
						composerStatusMessage={composerStatusMessage}
						mission={mission}
						probeVerdictLabel={probeVerdictLabel}
						runtimeStatusLabel={runtimeStatusLabel}
					/>
				</div>
			</div>
		</div>
	);
};

export default Route;
