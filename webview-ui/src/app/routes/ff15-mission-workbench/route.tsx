import { SidebarActionButton } from "@/components/sidebar-action-button";
import { TextareaPanel } from "@/components/textarea-panel";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	useComboboxAnchor,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { vscode } from "@/lib/vscode";
import { CheckIcon, PencilIcon } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { PartyRosterPanel } from "./components/party-roster-panel";

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
	providerId: "github-copilot-cli" | "opencode";
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

interface MissionWorkbenchModelDefinition {
	efforts: { label: string; value: string }[];
	id: string;
	name: string;
}

interface MissionWorkbenchPartyAgent {
	agentId: "noctis" | "ignis" | "gladiolus" | "prompto";
	available: boolean;
	displayName: string;
	model: {
		effort: string | null;
		effortLabel: string | null;
		modelId: string;
		modelName: string;
	};
	paneId: string | null;
}

interface MissionWorkbenchProviderActionState {
	enabled: boolean;
	supported: boolean;
	unavailableReason: string | null;
}

interface MissionWorkbenchProviderState {
	capabilities: {
		continueAgent: MissionWorkbenchProviderActionState;
		modelSelection: MissionWorkbenchProviderActionState;
	};
	id: "github-copilot-cli" | "opencode";
}

interface MissionWorkbenchState {
	modelCatalog: MissionWorkbenchModelDefinition[];
	modelCatalogStatusMessage: string | null;
	mission: MissionWorkbenchMission | null;
	modelSelectionDisabledReason: string | null;
	operations: {
		supported: MissionWorkbenchCatalogEntry[];
		unsupported: MissionWorkbenchCatalogEntry[];
	};
	partyRoster: MissionWorkbenchPartyAgent[];
	provider: MissionWorkbenchProviderState | null;
}

const EMPTY_STATE: MissionWorkbenchState = {
	modelCatalog: [],
	modelCatalogStatusMessage: null,
	mission: null,
	modelSelectionDisabledReason: null,
	operations: {
		supported: [],
		unsupported: [],
	},
	partyRoster: [],
	provider: null,
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

const PROVIDER_LABELS: Record<MissionWorkbenchMission["providerId"], string> = {
	"github-copilot-cli": "GitHub Copilot",
	opencode: "OpenCode",
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

interface MissionWorkbenchHeaderProps {
	mission: MissionWorkbenchMission;
	onConfirmDelete: () => void;
	onOpenTerminal: () => void;
	onRenameTitle: () => void;
	onStartTitleEdit: () => void;
	onTitleDraftChange: (value: string) => void;
	onTitleEditKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
	isEditingTitle: boolean;
	pendingDelete: boolean;
	probeVerdictLabel: string;
	renameActionDisabled: boolean;
	runtimeStatusLabel: string;
	selectedOperation: MissionWorkbenchCatalogEntry | null;
	terminalActionLabel: string;
	titleDraft: string;
}

const MissionWorkbenchHeader = ({
	mission,
	onConfirmDelete,
	onOpenTerminal,
	onRenameTitle,
	onStartTitleEdit,
	onTitleDraftChange,
	onTitleEditKeyDown,
	isEditingTitle,
	pendingDelete,
	probeVerdictLabel,
	renameActionDisabled,
	runtimeStatusLabel,
	selectedOperation,
	terminalActionLabel,
	titleDraft,
}: MissionWorkbenchHeaderProps) => (
	<div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--vscode-editor-background)_94%,transparent),color-mix(in_srgb,var(--vscode-button-background,#0e7490)_12%,transparent))] px-4 py-3">
		<div className="flex min-w-0 flex-col gap-3">
			<div className="flex min-w-0 flex-col gap-1">
				<div className="text-[9px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.68))] uppercase tracking-[0.16em]">
					Mission Name
				</div>
				{isEditingTitle ? (
					<div className="flex min-w-0 items-center gap-2">
						<Input
							aria-label="Mission title"
							autoFocus
							className="h-10 min-w-0 flex-1 rounded-xl border-[color:color-mix(in_srgb,var(--vscode-foreground)_18%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_78%,transparent)] px-3 text-[color:var(--vscode-foreground)] text-sm"
							onChange={(event) => {
								onTitleDraftChange(event.target.value);
							}}
							onKeyDown={onTitleEditKeyDown}
							placeholder="Rename this mission"
							value={titleDraft}
						/>
						<SidebarActionButton
							aria-label="Save mission title"
							className="h-10 w-10 rounded-xl px-0"
							disabled={renameActionDisabled}
							onClick={onRenameTitle}
						>
							<CheckIcon className="h-4 w-4" />
						</SidebarActionButton>
					</div>
				) : (
					<div className="flex min-w-0 items-center gap-2">
						<h1 className="min-w-0 flex-1 truncate font-semibold text-[color:var(--vscode-foreground)] text-lg tracking-[0.02em]">
							{mission.title}
						</h1>
						<SidebarActionButton
							aria-label="Edit mission title"
							className="h-9 w-9 rounded-xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_16%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_72%,transparent)] px-0 text-[color:var(--vscode-foreground)] hover:bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_84%,transparent)]"
							onClick={onStartTitleEdit}
						>
							<PencilIcon className="h-4 w-4" />
						</SidebarActionButton>
					</div>
				)}
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<SidebarActionButton
					className="h-7 w-auto px-3 text-[11px]"
					onClick={onOpenTerminal}
				>
					{terminalActionLabel}
				</SidebarActionButton>
				<SidebarActionButton
					className="h-7 w-auto border border-[color:var(--vscode-errorForeground,#f87171)]/35 bg-transparent px-3 text-[11px] text-[color:var(--vscode-errorForeground,#f87171)] hover:bg-[color:var(--vscode-errorForeground,#f87171)]/12"
					onClick={onConfirmDelete}
				>
					{pendingDelete ? "Confirm Delete" : "Delete Mission"}
				</SidebarActionButton>
			</div>

			<div className="flex flex-wrap items-center gap-2">
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
				<span className="w-fit rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_18%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_82%,transparent)] px-2 py-0.5 font-medium text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.12em]">
					Provider {PROVIDER_LABELS[mission.providerId]}
				</span>
				<span className="w-fit rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_18%,transparent)] px-2 py-0.5 font-medium text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.12em]">
					{mission.terminalReady ? "Terminal Attached" : "Terminal Detached"}
				</span>
				<span className="w-fit rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_18%,transparent)] px-2 py-0.5 font-medium text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.12em]">
					Probe {probeVerdictLabel}
				</span>
			</div>

			<Accordion
				className="rounded-xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_10%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_64%,transparent)] px-3"
				type="multiple"
			>
				<AccordionItem className="border-none" value="mission-details">
					<AccordionTrigger className="py-2.5 text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.16em] hover:no-underline">
						Mission Details
					</AccordionTrigger>
					<AccordionContent className="grid gap-2.5 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.76))] text-xs leading-5">
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
					<AccordionTrigger className="py-2.5 text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.16em] hover:no-underline">
						Runtime Notes
					</AccordionTrigger>
					<AccordionContent className="grid gap-2.5 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.76))] text-xs leading-5">
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
	filteredUnsupportedOperations: MissionWorkbenchCatalogEntry[];
	hasCatalogEntries: boolean;
	hasDeliverableOperation: boolean;
	hasUnsupportedOperations: boolean;
	onOperationQueryChange: (value: string) => void;
	onSelectOperation: (operationRef: string) => void;
	operationQuery: string;
	selectedOperation: MissionWorkbenchCatalogEntry | null;
	supportedOperations: MissionWorkbenchCatalogEntry[];
	supportedOperationCount: number;
}

const OperationCatalogPanel = ({
	filteredUnsupportedOperations,
	hasCatalogEntries,
	hasDeliverableOperation,
	hasUnsupportedOperations,
	onOperationQueryChange,
	onSelectOperation,
	operationQuery,
	selectedOperation,
	supportedOperations,
	supportedOperationCount,
}: OperationCatalogPanelProps) => {
	const comboboxAnchor = useComboboxAnchor();

	return (
		<div className="flex flex-col gap-3 rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_74%,transparent)] px-4 py-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="font-semibold text-[color:var(--vscode-foreground)] text-xs uppercase tracking-[0.18em]">
					Operation
				</div>
				<span className="rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_16%,transparent)] px-2.5 py-1 font-medium text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.12em]">
					{hasDeliverableOperation ? "Ready" : "Required"} ·{" "}
					{supportedOperationCount}
				</span>
			</div>

			<Combobox
				inputValue={operationQuery}
				items={supportedOperations}
				itemToStringLabel={(operation) =>
					[operation.name, operation.ref, operation.fileName].join(" ")
				}
				itemToStringValue={(operation) => operation.name}
				onInputValueChange={onOperationQueryChange}
				onValueChange={(operation) => {
					if (operation) {
						onSelectOperation(operation.ref);
					}
				}}
				value={selectedOperation?.supported ? selectedOperation : undefined}
			>
				<ComboboxInput
					anchorRef={comboboxAnchor}
					aria-label="Choose operation"
					className={cn(
						"w-full",
						"[&_[data-slot=input-group]]:h-9",
						"[&_[data-slot=input-group-input]]:border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)]",
						"[&_[data-slot=input-group-input]]:bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_82%,transparent)]",
						"[&_[data-slot=input-group-input]]:text-sm",
						"[&_[data-slot=input-group-input]]:text-[color:var(--vscode-foreground)]"
					)}
					placeholder="Search supported operations"
					showTrigger
				/>
				<ComboboxContent
					anchor={comboboxAnchor}
					className="border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_96%,transparent)] text-[color:var(--vscode-foreground)]"
					sideOffset={8}
				>
					<ComboboxEmpty className="px-3 py-3 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.68))] text-xs">
						No supported operations match the current query.
					</ComboboxEmpty>
					<ComboboxList>
						{(operation: MissionWorkbenchCatalogEntry) => (
							<ComboboxItem value={operation}>
								<div className="min-w-0">
									<div className="truncate font-medium text-sm">
										{operation.name}
									</div>
									<div className="truncate text-[11px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.68))]">
										{operation.ref}
									</div>
								</div>
							</ComboboxItem>
						)}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>

			<div className="text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.68))] leading-4">
				{selectedOperation?.ref ?? OPERATION_REQUIRED_MESSAGE}
			</div>

			{hasCatalogEntries ? (
				<div className="grid gap-3">
					{hasUnsupportedOperations ? (
						<Accordion
							className="rounded-xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_10%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_68%,transparent)] px-3"
							collapsible
							type="single"
						>
							<AccordionItem
								className="border-none"
								value="unsupported-operations"
							>
								<AccordionTrigger className="py-2.5 text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.16em] hover:no-underline">
									Unsupported Operations ({filteredUnsupportedOperations.length}
									)
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
										<div className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.7))] text-xs leading-5">
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
};

interface PromptComposerPanelProps {
	composerActionDisabled: boolean;
	composerActionLabel: string;
	composerDisabled: boolean;
	composerStatusMessage: string;
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
	composerStatusMessage,
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
		<div className="flex min-h-0 flex-1 flex-col gap-3 rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_74%,transparent)] px-4 py-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="font-semibold text-[color:var(--vscode-foreground)] text-xs uppercase tracking-[0.18em]">
					Prompt Composer
				</div>
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
			</div>

			<div
				className={cn(
					"rounded-xl border px-3 py-2 text-[11px] leading-5",
					mission.lastError
						? "border-[color:var(--vscode-errorForeground,#f87171)]/35 bg-[color:var(--vscode-errorForeground,#f87171)]/10 text-[color:var(--vscode-errorForeground,#f87171)]"
						: "border-[color:color-mix(in_srgb,var(--vscode-foreground)_10%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_68%,transparent)] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))]"
				)}
			>
				{composerStatusMessage}
			</div>

			<div className="min-h-0 flex-1">
				<TextareaPanel
					containerClassName="px-0"
					disabled={composerDisabled}
					onChange={(event) => {
						onDraftChange(event.target.value);
					}}
					placeholder={composerPlaceholder}
					rows={10}
					textareaClassName="min-h-[15rem] px-4 text-sm leading-6"
					value={draft}
				>
					<div className="flex items-center justify-between gap-3 border-[color:color-mix(in_srgb,var(--vscode-foreground)_10%,transparent)] border-t px-4 pt-2.5 pb-2.5">
						<div className="min-w-0 text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] leading-4">
							{footerMessage}
						</div>
						<SidebarActionButton
							className="h-7 w-auto self-end px-3 text-[11px]"
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

const Route = () => {
	const [draft, setDraft] = useState("");
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [operationQuery, setOperationQuery] = useState("");
	const [pendingDelete, setPendingDelete] = useState(false);
	const [state, setState] = useState<MissionWorkbenchState>(EMPTY_STATE);
	const [titleDraft, setTitleDraft] = useState("");

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

	useEffect(() => {
		setTitleDraft(mission?.title ?? "");
		setIsEditingTitle(false);
	}, [mission?.title]);

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

	const handleTitleDraftChange = (value: string) => {
		setPendingDelete(false);
		setTitleDraft(value);
	};

	const handleStartTitleEdit = () => {
		setPendingDelete(false);
		setIsEditingTitle(true);
	};

	const handleRenameTitle = () => {
		if (!mission) {
			return;
		}

		const nextTitle = titleDraft.trim();
		if (nextTitle.length === 0 || nextTitle === mission.title) {
			return;
		}

		vscode.postMessage({
			command: "ff15-mission-workbench.rename-title",
			title: nextTitle,
		});
	};

	const handleTitleEditKeyDown = (
		event: React.KeyboardEvent<HTMLInputElement>
	) => {
		if (event.key === "Enter") {
			event.preventDefault();
			handleRenameTitle();
			return;
		}

		if (event.key === "Escape") {
			event.preventDefault();
			setTitleDraft(mission?.title ?? "");
			setIsEditingTitle(false);
		}
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

	const handleContinueAgent = (
		agentId: MissionWorkbenchPartyAgent["agentId"]
	) => {
		vscode.postMessage({
			agentId,
			command: "ff15-mission-workbench.continue-agent",
		});
	};

	const handleChangeAgentModel = (input: {
		agentId: MissionWorkbenchPartyAgent["agentId"];
		effort: string | null;
		modelId: string;
	}) => {
		vscode.postMessage({
			agentId: input.agentId,
			command: "ff15-mission-workbench.change-agent-model",
			effort: input.effort,
			modelId: input.modelId,
		});
	};

	const handleChangeAgentVariant = (input: {
		agentId: MissionWorkbenchPartyAgent["agentId"];
		effort: string | null;
		modelId: string;
	}) => {
		vscode.postMessage({
			agentId: input.agentId,
			command: "ff15-mission-workbench.change-agent-variant",
			effort: input.effort,
			modelId: input.modelId,
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
		<div className="mx-auto flex h-full max-w-5xl flex-col gap-4 px-5 py-4">
			<MissionWorkbenchHeader
				isEditingTitle={isEditingTitle}
				mission={mission}
				onConfirmDelete={handleConfirmDelete}
				onOpenTerminal={handleOpenTerminal}
				onRenameTitle={handleRenameTitle}
				onStartTitleEdit={handleStartTitleEdit}
				onTitleDraftChange={handleTitleDraftChange}
				onTitleEditKeyDown={handleTitleEditKeyDown}
				pendingDelete={pendingDelete}
				probeVerdictLabel={probeVerdictLabel}
				renameActionDisabled={
					titleDraft.trim().length === 0 || titleDraft.trim() === mission.title
				}
				runtimeStatusLabel={runtimeStatusLabel}
				selectedOperation={selectedOperation}
				terminalActionLabel={terminalActionLabel}
				titleDraft={titleDraft}
			/>

			<div className="flex min-h-0 flex-1 flex-col gap-4">
				<OperationCatalogPanel
					filteredUnsupportedOperations={filteredUnsupportedOperations}
					hasCatalogEntries={hasCatalogEntries}
					hasDeliverableOperation={hasDeliverableOperation}
					hasUnsupportedOperations={hasUnsupportedOperations}
					onOperationQueryChange={handleOperationQueryChange}
					onSelectOperation={handleSelectOperation}
					operationQuery={operationQuery}
					selectedOperation={selectedOperation}
					supportedOperationCount={state.operations.supported.length}
					supportedOperations={state.operations.supported}
				/>

				<PartyRosterPanel
					modelCatalog={state.modelCatalog}
					modelCatalogStatusMessage={state.modelCatalogStatusMessage}
					modelSelectionDisabledReason={state.modelSelectionDisabledReason}
					onChangeAgentModel={handleChangeAgentModel}
					onChangeAgentVariant={handleChangeAgentVariant}
					onContinueAgent={handleContinueAgent}
					partyRoster={state.partyRoster}
					partyRosterEnabled={mission.terminalReady}
					provider={state.provider}
				/>

				<PromptComposerPanel
					composerActionDisabled={composerActionDisabled}
					composerActionLabel={composerActionLabel}
					composerDisabled={composerDisabled}
					composerPlaceholder={composerPlaceholder}
					composerStatusMessage={composerStatusMessage}
					draft={draft}
					hasDeliverableOperation={hasDeliverableOperation}
					mission={mission}
					onDraftChange={handleDraftChange}
					onSend={handleSend}
				/>
			</div>
		</div>
	);
};

export default Route;
