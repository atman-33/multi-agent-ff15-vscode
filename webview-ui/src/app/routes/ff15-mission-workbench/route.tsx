import { DevBadge } from "@/components/dev-badge";
import { Ff15Badge, type Ff15BadgeTone } from "@/components/ff15/ff15-badge";
import { Ff15Panel } from "@/components/ff15/ff15-panel";
import { Ff15Screen } from "@/components/ff15/ff15-screen";
import { Ff15SectionHeading } from "@/components/ff15/ff15-section-heading";
import { SidebarActionButton } from "@/components/sidebar-action-button";
import { useDevMode } from "@/hooks/use-dev-mode";
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
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { vscode } from "@/lib/vscode";
import { CheckIcon, PencilIcon, SendHorizontalIcon } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { PartyRosterPanel } from "./components/party-roster-panel";

type MissionWorkbenchAgentId = "noctis" | "ignis" | "gladiolus" | "prompto";

interface MissionWorkbenchCatalogEntry {
	fileName: string;
	initialStepAgent: MissionWorkbenchAgentId;
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
	"Choose a supported operation to unlock prompt delivery.";

const PROVIDER_LABELS: Record<MissionWorkbenchMission["providerId"], string> = {
	"github-copilot-cli": "GitHub Copilot",
	opencode: "OpenCode",
};

const AGENT_DISPLAY_NAMES: Record<MissionWorkbenchAgentId, string> = {
	gladiolus: "Gladiolus",
	ignis: "Ignis",
	noctis: "Noctis",
	prompto: "Prompto",
};

/**
 * Single operational status for the mission, consolidating the previous row of
 * separate badges. Shared by the header pill and the composer so the two never
 * drift or duplicate.
 */
const getPrimaryMissionStatus = (
	mission: MissionWorkbenchMission,
	hasDeliverableOperation: boolean
): { label: string; tone: Ff15BadgeTone } => {
	if (mission.lastError) {
		return { label: "Delivery Error", tone: "error" };
	}

	if (mission.status === "sending") {
		return { label: "Sending", tone: "sending" };
	}

	if (!hasDeliverableOperation) {
		return { label: "Operation Required", tone: "gold" };
	}

	if (!mission.terminalReady) {
		return { label: "Launch Required", tone: "sending" };
	}

	if (mission.status === "active") {
		return { label: "Active", tone: "active" };
	}

	return { label: "Draft", tone: "neutral" };
};

const getComposerStatusMessage = ({
	deliveryAgentLabel,
	draft,
	hasDeliverableOperation,
	mission,
	terminalActionLabel,
}: {
	deliveryAgentLabel: string;
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
			? "Choose a supported operation before sending this message."
			: OPERATION_REQUIRED_MESSAGE;
	}

	if (!mission.terminalReady) {
		return `${terminalActionLabel} before sending a message to ${deliveryAgentLabel}.`;
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

const getComposerActionLabel = (input: {
	deliveryAgentName: string | null;
	retryingErroredMission: boolean;
}): string => {
	if (input.retryingErroredMission) {
		return "Retry Delivery";
	}

	if (input.deliveryAgentName) {
		return `Send to ${input.deliveryAgentName}`;
	}

	return "Send Prompt";
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
	primaryStatus: { label: string; tone: Ff15BadgeTone };
	probeVerdictLabel: string;
	renameActionDisabled: boolean;
	runtimeStatusLabel: string;
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
	primaryStatus,
	probeVerdictLabel,
	renameActionDisabled,
	runtimeStatusLabel,
	terminalActionLabel,
	titleDraft,
}: MissionWorkbenchHeaderProps) => (
	<Ff15Panel className="px-4 py-3">
		<div className="flex min-w-0 flex-col gap-2.5">
			<div className="flex min-w-0 flex-wrap items-center gap-2">
				{isEditingTitle ? (
					<div className="flex min-w-0 flex-1 items-center gap-2">
						<Input
							aria-label="Mission title"
							autoFocus
							className="h-8 min-w-0 flex-1 rounded-lg border-[color:var(--ff15-border-soft)] bg-[color:rgba(8,10,16,0.6)] px-3 text-[color:var(--ff15-text)] text-sm"
							onChange={(event) => {
								onTitleDraftChange(event.target.value);
							}}
							onKeyDown={onTitleEditKeyDown}
							placeholder="Rename this mission"
							value={titleDraft}
						/>
						<SidebarActionButton
							aria-label="Save mission title"
							className="h-8 w-8 rounded-lg px-0"
							disabled={renameActionDisabled}
							onClick={onRenameTitle}
						>
							<CheckIcon className="h-4 w-4" />
						</SidebarActionButton>
					</div>
				) : (
					<div className="flex min-w-0 flex-1 items-center gap-1.5">
						<h1 className="min-w-0 truncate font-semibold text-[color:var(--ff15-text)] text-lg tracking-[0.04em]">
							{mission.title}
						</h1>
						<button
							aria-label="Edit mission title"
							className="shrink-0 rounded-md p-1 text-[color:var(--ff15-text-muted)] transition-colors hover:text-[color:var(--ff15-gold)]"
							onClick={onStartTitleEdit}
							type="button"
						>
							<PencilIcon className="h-3.5 w-3.5" />
						</button>
					</div>
				)}
				<div className="flex shrink-0 items-center gap-2">
					<SidebarActionButton
						className="h-7 w-auto px-3 text-[11px]"
						onClick={onOpenTerminal}
					>
						{terminalActionLabel}
					</SidebarActionButton>
					<SidebarActionButton
						className="h-7 w-auto border border-[color:rgba(248,113,113,0.4)] bg-transparent px-3 text-[11px] text-[color:#fca5a5] hover:border-[color:rgba(248,113,113,0.6)] hover:bg-[color:rgba(248,113,113,0.12)] hover:text-[color:#fca5a5]"
						onClick={onConfirmDelete}
					>
						{pendingDelete ? "Confirm Delete" : "Delete"}
					</SidebarActionButton>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<Ff15Badge tone={primaryStatus.tone}>{primaryStatus.label}</Ff15Badge>
				<Ff15Badge tone="neutral">
					{PROVIDER_LABELS[mission.providerId]}
				</Ff15Badge>
			</div>

			<Accordion
				className="rounded-xl border border-[color:var(--ff15-border-soft)] bg-[color:rgba(8,10,16,0.5)] px-3"
				collapsible
				type="single"
			>
				<AccordionItem className="border-none" value="details">
					<AccordionTrigger className="ff15-label py-2 tracking-[0.16em] hover:no-underline">
						Details
					</AccordionTrigger>
					<AccordionContent className="grid gap-2.5 text-[color:var(--ff15-text-muted)] text-xs leading-5">
						<div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
							<div>
								<div className="text-[10px] uppercase tracking-[0.14em]">
									Current Step
								</div>
								<div className="text-[color:var(--ff15-text)]">
									{mission.workflow.currentStep ?? "Not reported yet"}
								</div>
							</div>
							<div>
								<div className="text-[10px] uppercase tracking-[0.14em]">
									Active Task
								</div>
								<div className="text-[color:var(--ff15-text)]">
									{mission.workflow.activeTask ?? "Not reported yet"}
								</div>
							</div>
							<div>
								<div className="text-[10px] uppercase tracking-[0.14em]">
									Runtime
								</div>
								<div className="text-[color:var(--ff15-text)]">
									{runtimeStatusLabel}
								</div>
							</div>
							<div>
								<div className="text-[10px] uppercase tracking-[0.14em]">
									Probe
								</div>
								<div className="text-[color:var(--ff15-text)]">
									{probeVerdictLabel}
								</div>
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
						{mission.workflow.probe.summary ? (
							<div className="grid gap-1">
								<div className="text-[10px] uppercase tracking-[0.14em]">
									Probe Summary
								</div>
								<div>{mission.workflow.probe.summary}</div>
							</div>
						) : null}
						{mission.workflow.lastReportSummary ? (
							<div className="grid gap-1">
								<div className="text-[10px] uppercase tracking-[0.14em]">
									Last Report
								</div>
								<div>{mission.workflow.lastReportSummary}</div>
							</div>
						) : null}
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
	// The shadcn Combobox input no longer wraps itself in an anchor element, so
	// the popup would otherwise anchor to the small trigger button and collapse
	// its width. Anchor the popup to this full-width wrapper instead.
	const comboboxAnchor = useRef<HTMLDivElement | null>(null);

	return (
		<Ff15Panel className="flex flex-col gap-2.5 px-4 py-3">
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
				filter={(operation, query) =>
					matchesOperationQuery(operation, normalizeOperationQuery(query))
				}
				inputValue={operationQuery}
				items={supportedOperations}
				itemToStringLabel={(operation) => operation.name}
				itemToStringValue={(operation) => operation.name}
				onInputValueChange={onOperationQueryChange}
				onValueChange={(operation) => {
					if (operation) {
						onSelectOperation(operation.ref);
					}
				}}
				value={selectedOperation?.supported ? selectedOperation : undefined}
			>
				<div ref={comboboxAnchor}>
					<ComboboxInput
						aria-label="Choose operation"
						className={cn(
							"h-9 w-full",
							"[&_[data-slot=input-group-input]]:border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)]",
							"[&_[data-slot=input-group-input]]:bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_82%,transparent)]",
							"[&_[data-slot=input-group-input]]:text-sm",
							"[&_[data-slot=input-group-input]]:text-[color:var(--vscode-foreground)]"
						)}
						placeholder="Search supported operations"
						showClear
						showTrigger
					/>
				</div>
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
	// Only surface the contextual note when the composer is blocked or errored.
	// In the normal ready state the placeholder is enough — no redundant box.
	const showStatusNote =
		Boolean(mission.lastError) ||
		!hasDeliverableOperation ||
		!mission.terminalReady;

	return (
		<Ff15Panel className="flex min-h-0 flex-1 flex-col gap-2.5 px-4 py-3">
			<Ff15SectionHeading title="Prompt Composer" />

			{showStatusNote ? (
				<div
					className={cn(
						"rounded-lg border px-3 py-1.5 text-[11px] leading-5",
						mission.lastError
							? "border-[color:rgba(248,113,113,0.4)] bg-[color:rgba(248,113,113,0.1)] text-[color:#fca5a5]"
							: "border-[color:var(--ff15-border-soft)] bg-[color:rgba(8,10,16,0.5)] text-[color:var(--ff15-text-muted)]"
					)}
				>
					{composerStatusMessage}
				</div>
			) : null}

			<div className="min-h-0 flex-1 basis-[16rem]">
				<TextareaPanel
					containerClassName="px-0"
					disabled={composerDisabled}
					onChange={(event) => {
						onDraftChange(event.target.value);
					}}
					placeholder={composerPlaceholder}
					rows={10}
					textareaClassName="h-full min-h-0 overflow-y-auto px-4 text-sm leading-6"
					value={draft}
				>
					{/* Footer action bar: a dedicated non-input strip below the
					    textarea for the Send action and any future controls/status. */}
					<div className="flex items-center justify-end gap-3 border-[color:var(--ff15-border-soft)] border-t px-4 pt-2.5">
						<SidebarActionButton
							className="h-7 w-auto gap-1.5 px-4 text-[11px]"
							disabled={composerActionDisabled}
							onClick={onSend}
						>
							<SendHorizontalIcon className="h-3.5 w-3.5" />
							{composerActionLabel}
						</SidebarActionButton>
					</div>
				</TextareaPanel>
			</div>
		</Ff15Panel>
	);
};

const useMissionWorkbenchState = () => {
	const [state, setState] = useState<MissionWorkbenchState>(EMPTY_STATE);
	const [isLoading, setIsLoading] = useState(true);
	const devMode = useDevMode("ff15-mission-workbench.state");

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

	return { devMode, isLoading, state };
};

const Route = () => {
	const [draft, setDraft] = useState("");
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [operationQuery, setOperationQuery] = useState("");
	const [pendingDelete, setPendingDelete] = useState(false);
	const [titleDraft, setTitleDraft] = useState("");
	const { devMode, isLoading, state } = useMissionWorkbenchState();

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
	// Reflect the confirmed operation into the Combobox input. The Combobox is
	// controlled on both `value` and `inputValue`, which disables Base UI's
	// built-in selection->input sync, so we own that reconciliation here.
	// Depend on the primitive ref/name (not the object identity) so unrelated
	// state echoes — e.g. runtime probe updates that rebuild the operations
	// array — do not clobber an in-progress search query.
	useEffect(() => {
		setOperationQuery(selectedOperation ? selectedOperation.name : "");
	}, [selectedOperation?.ref, selectedOperation?.name]);
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
	// The mission prompt is delivered to the agent that owns the selected
	// operation's initial step (Noctis for the bundled operations today). Surface
	// that agent dynamically rather than hard-coding "Noctis".
	const deliveryAgentName = selectedOperation
		? AGENT_DISPLAY_NAMES[selectedOperation.initialStepAgent]
		: null;
	const deliveryAgentLabel = deliveryAgentName ?? "the lead agent";
	const composerActionLabel = getComposerActionLabel({
		deliveryAgentName,
		retryingErroredMission,
	});
	const terminalActionLabel = mission?.terminalReady
		? "Reopen Terminal"
		: "Launch Terminal";
	const runtimeStatusLabel = getRuntimeStatusLabel(mission);
	const probeVerdictLabel = getProbeVerdictLabel(mission);
	const composerStatusMessage = getComposerStatusMessage({
		deliveryAgentLabel,
		draft,
		hasDeliverableOperation,
		mission,
		terminalActionLabel,
	});
	let composerPlaceholder =
		"Choose a supported operation before drafting a delivery.";
	if (hasDeliverableOperation) {
		composerPlaceholder = mission?.terminalReady
			? `Draft a message for ${mission?.title ?? "this mission"}...`
			: `Launch Terminal before sending a delivery to ${deliveryAgentLabel}.`;
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
		// Optimistically show the selected operation name in the input. This also
		// covers re-selecting the same operation after a clear, where the
		// `selectedOperation` effect would not re-fire (ref is unchanged). The
		// effect still reconciles the input on initial mount / async echoes.
		const selected = state.operations.supported.find(
			(operation) => operation.ref === operationRef
		);
		setOperationQuery(selected ? selected.name : "");
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

	if (isLoading) {
		return (
			<Ff15Screen contentClassName="flex items-center justify-center">
				<Spinner size={32} />
			</Ff15Screen>
		);
	}

	if (!mission) {
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
		<Ff15Screen contentClassName="mx-auto flex h-full w-full max-w-6xl flex-col gap-3 px-4 py-3">
			{devMode ? <DevBadge /> : null}
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
				primaryStatus={getPrimaryMissionStatus(
					mission,
					hasDeliverableOperation
				)}
				probeVerdictLabel={probeVerdictLabel}
				renameActionDisabled={
					titleDraft.trim().length === 0 || titleDraft.trim() === mission.title
				}
				runtimeStatusLabel={runtimeStatusLabel}
				terminalActionLabel={terminalActionLabel}
				titleDraft={titleDraft}
			/>

			<div className="grid flex-1 gap-3 md:min-h-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
				{/* Primary column (right on md): operation selection sits atop the
				    composer, which expands to own the remaining height. */}
				<div className="flex min-h-0 flex-col gap-3 md:order-2">
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

				{/* Secondary column (left on md): the party roster. */}
				<div className="md:order-1 md:min-h-0 md:overflow-y-auto md:pr-1">
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
				</div>
			</div>
		</Ff15Screen>
	);
};

export default Route;
