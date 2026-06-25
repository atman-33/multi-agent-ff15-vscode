import { Ff15Badge, type Ff15BadgeTone } from "@/components/ff15/ff15-badge";
import { Ff15Panel } from "@/components/ff15/ff15-panel";
import { Ff15RuneButton } from "@/components/ff15/ff15-rune-button";
import { Ff15Screen } from "@/components/ff15/ff15-screen";
import { Ff15SectionHeading } from "@/components/ff15/ff15-section-heading";
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
import { Spinner } from "@/components/ui/spinner";
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
	bulkModelSelection: {
		effort: string | null;
		modelId: string;
	} | null;
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
	bulkModelSelection: null,
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

const getRuntimeStatusTone = (
	status: MissionWorkbenchMission["workflow"]["runtimeStatus"]
): Ff15BadgeTone => {
	if (status === "ready") {
		return "active";
	}

	if (status === "starting") {
		return "sending";
	}

	if (status === "unavailable") {
		return "error";
	}

	return "neutral";
};

const getMissionStatusTone = (
	status: MissionWorkbenchMission["status"]
): Ff15BadgeTone => {
	switch (status) {
		case "active":
			return "active";
		case "error":
			return "error";
		case "sending":
			return "sending";
		default:
			return "neutral";
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
	<Ff15Panel className="px-4 py-3.5">
		<div className="flex min-w-0 flex-col gap-3">
			<div className="flex min-w-0 flex-col gap-1.5">
				<span className="ff15-label">Mission Name</span>
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
						<h1 className="min-w-0 flex-1 truncate border-[color:var(--ff15-gold-soft)] border-b pb-1 font-semibold text-[color:var(--ff15-text)] text-lg tracking-[0.04em]">
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
				<Ff15RuneButton
					className="h-7 px-3 text-[11px]"
					onClick={onOpenTerminal}
				>
					{terminalActionLabel}
				</Ff15RuneButton>
				<SidebarActionButton
					className="h-7 w-auto border border-[color:rgba(248,113,113,0.4)] bg-transparent px-3 text-[11px] text-[color:#fca5a5] hover:bg-[color:rgba(248,113,113,0.12)]"
					onClick={onConfirmDelete}
				>
					{pendingDelete ? "Confirm Delete" : "Delete Mission"}
				</SidebarActionButton>
			</div>

			<div className="ff15-divider" />

			<div className="flex flex-wrap items-center gap-2">
				<Ff15Badge tone={getMissionStatusTone(mission.status)}>
					{MISSION_STATUS_LABELS[mission.status]}
				</Ff15Badge>
				<Ff15Badge tone={getRuntimeStatusTone(mission.workflow.runtimeStatus)}>
					Runtime {runtimeStatusLabel}
				</Ff15Badge>
				<Ff15Badge tone="neutral">
					Provider {PROVIDER_LABELS[mission.providerId]}
				</Ff15Badge>
				<Ff15Badge tone={mission.terminalReady ? "active" : "neutral"}>
					{mission.terminalReady ? "Terminal Attached" : "Terminal Detached"}
				</Ff15Badge>
				<Ff15Badge tone="neutral">Probe {probeVerdictLabel}</Ff15Badge>
			</div>

			<Accordion
				className="rounded-xl border border-[color:var(--ff15-border-soft)] bg-[color:rgba(8,10,16,0.5)] px-3"
				type="multiple"
			>
				<AccordionItem className="border-none" value="mission-details">
					<AccordionTrigger className="ff15-label py-2.5 tracking-[0.16em] hover:no-underline">
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
					<AccordionTrigger className="ff15-label py-2.5 tracking-[0.16em] hover:no-underline">
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
	</Ff15Panel>
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
			"rounded-2xl border px-4 py-3 text-left transition-all",
			selected
				? "border-[color:var(--ff15-gold-soft)] bg-[color:var(--ff15-gold-faint)] shadow-[0_0_18px_-4px_var(--ff15-gold-soft)]"
				: "border-[color:var(--ff15-border-soft)] bg-[color:rgba(8,10,16,0.45)] hover:border-[color:var(--ff15-border)]"
		)}
		onClick={() => {
			onSelect(operation.ref);
		}}
		type="button"
	>
		<div className="flex items-start justify-between gap-3">
			<div className="min-w-0">
				<div className="truncate font-medium text-[color:var(--ff15-text)] text-sm">
					{operation.name}
				</div>
				<div className="mt-1 break-all text-[color:var(--ff15-text-muted)] text-xs leading-5">
					Ref: {operation.ref}
				</div>
			</div>
			{selected ? <Ff15Badge tone="gold">Selected</Ff15Badge> : null}
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
		<Ff15Panel className="flex flex-col gap-3 px-4 py-3.5">
			<Ff15SectionHeading
				aside={
					<Ff15Badge tone={hasDeliverableOperation ? "active" : "gold"}>
						{hasDeliverableOperation ? "Ready" : "Required"} ·{" "}
						{supportedOperationCount}
					</Ff15Badge>
				}
				title="Operation"
			/>

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
							className="rounded-xl border border-[color:var(--ff15-border-soft)] bg-[color:rgba(8,10,16,0.5)] px-3"
							collapsible
							type="single"
						>
							<AccordionItem
								className="border-none"
								value="unsupported-operations"
							>
								<AccordionTrigger className="ff15-label py-2.5 tracking-[0.16em] hover:no-underline">
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
		</Ff15Panel>
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
		<Ff15Panel className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3.5">
			<Ff15SectionHeading
				aside={
					<Ff15Badge
						tone={
							hasDeliverableOperation && mission.terminalReady
								? "active"
								: "sending"
						}
					>
						{statusBadgeLabel}
					</Ff15Badge>
				}
				title="Prompt Composer"
			/>

			<div
				className={cn(
					"rounded-xl border px-3 py-2 text-[11px] leading-5",
					mission.lastError
						? "border-[color:rgba(248,113,113,0.4)] bg-[color:rgba(248,113,113,0.1)] text-[color:#fca5a5]"
						: "border-[color:var(--ff15-border-soft)] bg-[color:rgba(8,10,16,0.5)] text-[color:var(--ff15-text-muted)]"
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
					<div className="flex items-center justify-between gap-3 border-[color:var(--ff15-border-soft)] border-t px-4 pt-2.5 pb-2.5">
						<div className="min-w-0 text-[10px] text-[color:var(--ff15-text-muted)] leading-4">
							{footerMessage}
						</div>
						<Ff15RuneButton
							className="h-7 self-end px-3 text-[11px]"
							disabled={composerActionDisabled}
							onClick={onSend}
						>
							{composerActionLabel}
						</Ff15RuneButton>
					</div>
				</TextareaPanel>
			</div>
		</Ff15Panel>
	);
};

const Route = () => {
	const [draft, setDraft] = useState("");
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
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

			setIsLoading(false);
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

	const handleApplyBulkModel = (input: {
		effort: string | null;
		modelId: string;
	}) => {
		vscode.postMessage({
			command: "ff15-mission-workbench.apply-bulk-model",
			effort: input.effort,
			modelId: input.modelId,
		});
	};

	if (!mission) {
		if (isLoading) {
			return (
				<Ff15Screen contentClassName="flex items-center justify-center">
					<Spinner size={32} />
				</Ff15Screen>
			);
		}
		return (
			<Ff15Screen contentClassName="flex items-center justify-center px-6 py-6">
				<Ff15Panel className="max-w-md px-6 py-6 text-center text-[color:var(--ff15-text-muted)] text-sm leading-6">
					Mission Workbench could not load this mission. Return to the Missions
					sidebar and select it again.
				</Ff15Panel>
			</Ff15Screen>
		);
	}

	return (
		<Ff15Screen contentClassName="mx-auto flex h-full max-w-5xl flex-col gap-4 px-5 py-4">
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
					bulkLiveApplyEnabled={Boolean(
						state.provider?.capabilities.modelSelection.enabled
					)}
					bulkLiveApplyReason={
						state.provider?.capabilities.modelSelection.unavailableReason ??
						null
					}
					bulkModelSelection={state.bulkModelSelection}
					bulkModelSelectionSupported={Boolean(
						state.provider?.capabilities.modelSelection.supported
					)}
					modelCatalog={state.modelCatalog}
					modelCatalogStatusMessage={state.modelCatalogStatusMessage}
					modelSelectionDisabledReason={state.modelSelectionDisabledReason}
					onApplyBulkModel={handleApplyBulkModel}
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
		</Ff15Screen>
	);
};

export default Route;
