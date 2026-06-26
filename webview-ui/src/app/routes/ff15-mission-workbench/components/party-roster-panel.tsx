import { SidebarActionButton } from "@/components/sidebar-action-button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getWebviewAssetUri } from "@/lib/webview-asset";
import { CheckIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";

type PartyRosterAgentId = "noctis" | "ignis" | "gladiolus" | "prompto";

const AGENT_PORTRAITS: Record<PartyRosterAgentId, string> = {
	gladiolus: getWebviewAssetUri("images/gladiolus.png"),
	ignis: getWebviewAssetUri("images/ignis.png"),
	noctis: getWebviewAssetUri("images/noctis.png"),
	prompto: getWebviewAssetUri("images/prompto.png"),
};

const AGENT_THEMES: Record<
	PartyRosterAgentId,
	{
		accent: string;
		glow: string;
		glowSoft: string;
		surface: string;
		text: string;
	}
> = {
	gladiolus: {
		accent: "rgba(170, 58, 73, 0.8)",
		glow: "rgba(170, 58, 73, 0.22)",
		glowSoft: "rgba(170, 58, 73, 0.46)",
		surface:
			"linear-gradient(180deg, rgba(12, 8, 10, 0.98), rgba(7, 6, 8, 0.96) 58%, rgba(18, 9, 12, 0.94))",
		text: "rgba(248, 214, 220, 0.92)",
	},
	ignis: {
		accent: "rgba(75, 146, 114, 0.82)",
		glow: "rgba(75, 146, 114, 0.2)",
		glowSoft: "rgba(75, 146, 114, 0.4)",
		surface:
			"linear-gradient(180deg, rgba(7, 11, 9, 0.98), rgba(5, 8, 7, 0.96) 58%, rgba(9, 15, 12, 0.94))",
		text: "rgba(223, 247, 234, 0.92)",
	},
	noctis: {
		accent: "rgba(143, 156, 224, 0.82)",
		glow: "rgba(143, 156, 224, 0.2)",
		glowSoft: "rgba(143, 156, 224, 0.42)",
		surface:
			"linear-gradient(180deg, rgba(8, 10, 16, 0.98), rgba(6, 8, 13, 0.96) 58%, rgba(10, 12, 21, 0.94))",
		text: "rgba(224, 231, 255, 0.94)",
	},
	prompto: {
		accent: "rgba(240, 207, 115, 0.82)",
		glow: "rgba(240, 207, 115, 0.2)",
		glowSoft: "rgba(240, 207, 115, 0.42)",
		surface:
			"linear-gradient(180deg, rgba(14, 11, 5, 0.98), rgba(9, 8, 4, 0.96) 58%, rgba(17, 14, 8, 0.94))",
		text: "rgba(255, 243, 196, 0.92)",
	},
};

const AGENT_ROLE_LABELS: Record<PartyRosterAgentId, string> = {
	gladiolus: "Shield",
	ignis: "Strategist",
	noctis: "Lead",
	prompto: "Scout",
};

interface OpenCodeModelEffortOption {
	label: string;
	value: string;
}

interface OpenCodeModelDefinition {
	efforts: OpenCodeModelEffortOption[];
	id: string;
	name: string;
}

interface BulkModelSelection {
	effort: string | null;
	modelId: string;
}

interface PartyRosterAgent {
	agentId: PartyRosterAgentId;
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

interface ProviderActionState {
	enabled: boolean;
	supported: boolean;
	unavailableReason: string | null;
}

interface ProviderState {
	capabilities: {
		continueAgent: ProviderActionState;
		modelSelection: ProviderActionState;
	};
	id: "github-copilot-cli" | "opencode";
}

interface PartyRosterPanelProps {
	bulkLiveApplyEnabled: boolean;
	bulkLiveApplyReason: string | null;
	bulkModelSelection: BulkModelSelection | null;
	bulkModelSelectionSupported: boolean;
	modelCatalog: OpenCodeModelDefinition[];
	modelCatalogStatusMessage: string | null;
	modelSelectionDisabledReason: string | null;
	onApplyBulkModel: (input: BulkModelSelection) => void;
	onChangeAgentModel: (input: {
		agentId: PartyRosterAgent["agentId"];
		effort: string | null;
		modelId: string;
	}) => void;
	onChangeAgentVariant: (input: {
		agentId: PartyRosterAgent["agentId"];
		effort: string | null;
		modelId: string;
	}) => void;
	onContinueAgent: (agentId: PartyRosterAgent["agentId"]) => void;
	partyRosterEnabled: boolean;
	partyRoster: PartyRosterAgent[];
	provider: ProviderState | null;
}

interface AgentModelPickerProps {
	agent: PartyRosterAgent;
	disabled: boolean;
	modelCatalog: OpenCodeModelDefinition[];
	modelSelectionEnabled: boolean;
	modelSelectionSupported: boolean;
	modelSelectionDisabledReason: string | null;
	onChangeAgentModel: (input: {
		agentId: PartyRosterAgentId;
		effort: string | null;
		modelId: string;
	}) => void;
	onChangeAgentVariant: (input: {
		agentId: PartyRosterAgentId;
		effort: string | null;
		modelId: string;
	}) => void;
}

interface BulkModelPresetPanelProps {
	bulkLiveApplyEnabled: boolean;
	bulkLiveApplyReason: string | null;
	bulkModelSelection: BulkModelSelection | null;
	bulkModelSelectionSupported: boolean;
	modelCatalog: OpenCodeModelDefinition[];
	onApplyBulkModel: (input: BulkModelSelection) => void;
}

const normalizeBulkModelSelection = (
	selection: BulkModelSelection | null,
	modelCatalog: OpenCodeModelDefinition[]
): BulkModelSelection | null => {
	const fallbackModel = modelCatalog[0] ?? null;
	if (!fallbackModel) {
		return null;
	}

	const model =
		modelCatalog.find((candidate) => candidate.id === selection?.modelId) ??
		fallbackModel;
	const effort =
		typeof selection?.effort === "string" &&
		model.efforts.some((option) => option.value === selection.effort)
			? selection.effort
			: (model.efforts[0]?.value ?? null);

	return {
		effort,
		modelId: model.id,
	};
};

const isBulkSelectionEnabled = (
	supported: boolean,
	modelCatalog: OpenCodeModelDefinition[],
	selection: BulkModelSelection | null
) => {
	if (!supported) {
		return false;
	}

	if (modelCatalog.length === 0) {
		return false;
	}

	return selection !== null;
};

const AgentModelPicker = ({
	agent,
	disabled,
	modelCatalog,
	modelSelectionEnabled,
	modelSelectionSupported,
	modelSelectionDisabledReason,
	onChangeAgentModel,
	onChangeAgentVariant,
}: AgentModelPickerProps) => {
	const panelId = useId();

	if (!modelSelectionSupported) {
		return (
			<div
				className="flex min-h-6 items-center rounded-md border border-white/10 border-dashed bg-black/25 px-2"
				style={{
					color: "var(--vscode-descriptionForeground,rgba(255,255,255,0.64))",
					fontFamily: "var(--vscode-editor-font-family, monospace)",
					fontSize: "9px",
					letterSpacing: "0.14em",
					textTransform: "uppercase",
				}}
			>
				{modelSelectionDisabledReason ?? "Model controls unavailable"}
			</div>
		);
	}

	const activeModel =
		modelCatalog.find((model) => model.id === agent.model.modelId) ??
		modelCatalog[0] ??
		null;
	const effortEnabled = Boolean(activeModel?.efforts.length);
	const effortValue =
		agent.model.effort ?? activeModel?.efforts[0]?.value ?? undefined;

	const handleModelChange = (modelId: string) => {
		const nextModel = modelCatalog.find((model) => model.id === modelId);
		if (!nextModel) {
			return;
		}

		const nextEffort = nextModel.efforts.some(
			(option) => option.value === agent.model.effort
		)
			? agent.model.effort
			: (nextModel.efforts[0]?.value ?? null);

		onChangeAgentModel({
			agentId: agent.agentId,
			effort: nextEffort,
			modelId,
		});
	};

	const handleEffortChange = (value: string) => {
		onChangeAgentVariant({
			agentId: agent.agentId,
			effort: value,
			modelId: activeModel?.id ?? agent.model.modelId,
		});
	};

	return (
		<div className="flex items-stretch gap-1.5" id={panelId}>
			<div className="min-w-0 flex-1 basis-0">
				<Select
					disabled={!modelSelectionEnabled || disabled}
					onValueChange={handleModelChange}
					value={activeModel?.id ?? agent.model.modelId}
				>
					<SelectTrigger
						className={cn(
							"h-6 w-full min-w-0 px-2 font-mono text-[10px] uppercase tracking-[0.18em]",
							"hover:bg-black/60",
							"data-[placeholder]:text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.82))]",
							"[&_svg]:text-[color:var(--vscode-foreground)]"
						)}
						size="sm"
						style={{
							backgroundColor: "rgba(0, 0, 0, 0.5)",
							borderColor: "rgba(255, 255, 255, 0.12)",
							boxShadow: "none",
							color: "var(--vscode-foreground)",
						}}
					>
						<SelectValue placeholder="Select model" />
					</SelectTrigger>
					<SelectContent
						align="end"
						className="border-white/12 bg-[rgba(8,10,16,0.98)] text-[color:var(--vscode-foreground)]"
					>
						{modelCatalog.map((model) => (
							<SelectItem key={model.id} value={model.id}>
								{model.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="min-w-0 flex-1 basis-0">
				<Select
					disabled={disabled || !modelSelectionEnabled || !effortEnabled}
					onValueChange={handleEffortChange}
					value={effortValue}
				>
					<SelectTrigger
						className={cn(
							"h-6 w-full min-w-0 px-2 font-mono text-[10px] uppercase tracking-[0.18em]",
							"hover:bg-black/60",
							"disabled:text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.58))]",
							"data-[placeholder]:text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.82))]",
							"[&_svg]:text-[color:var(--vscode-foreground)]",
							"disabled:[&_svg]:text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.58))]"
						)}
						size="sm"
						style={{
							backgroundColor: "rgba(0, 0, 0, 0.5)",
							borderColor: "rgba(255, 255, 255, 0.12)",
							boxShadow: "none",
							color: "var(--vscode-foreground)",
						}}
					>
						<SelectValue placeholder="Effort unavailable" />
					</SelectTrigger>
					<SelectContent
						align="end"
						className="border-white/12 bg-[rgba(8,10,16,0.98)] text-[color:var(--vscode-foreground)]"
					>
						{activeModel?.efforts.map((effort) => (
							<SelectItem key={effort.value} value={effort.value}>
								{effort.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
};

const BulkModelPresetPanel = ({
	bulkLiveApplyEnabled,
	bulkLiveApplyReason,
	bulkModelSelection,
	bulkModelSelectionSupported,
	modelCatalog,
	onApplyBulkModel,
}: BulkModelPresetPanelProps) => {
	const [bulkDraft, setBulkDraft] = useState<BulkModelSelection | null>(() =>
		normalizeBulkModelSelection(bulkModelSelection, modelCatalog)
	);

	useEffect(() => {
		setBulkDraft(normalizeBulkModelSelection(bulkModelSelection, modelCatalog));
	}, [bulkModelSelection, modelCatalog]);

	const bulkSelectionEnabled = isBulkSelectionEnabled(
		bulkModelSelectionSupported,
		modelCatalog,
		bulkDraft
	);
	const bulkModel =
		bulkDraft === null
			? null
			: (modelCatalog.find((model) => model.id === bulkDraft.modelId) ?? null);
	let bulkEffortDisabled = true;
	if (
		bulkSelectionEnabled &&
		bulkModel !== null &&
		bulkModel.efforts.length > 0
	) {
		bulkEffortDisabled = false;
	}
	const applyDisabled = !bulkSelectionEnabled;

	const handleBulkModelChange = (modelId: string) => {
		const model = modelCatalog.find((entry) => entry.id === modelId);
		if (!model) {
			return;
		}

		setBulkDraft({
			effort: model.efforts.some((option) => option.value === bulkDraft?.effort)
				? (bulkDraft?.effort ?? null)
				: (model.efforts[0]?.value ?? null),
			modelId,
		});
	};

	const handleBulkEffortChange = (effort: string) => {
		if (!bulkDraft) {
			return;
		}

		setBulkDraft({
			...bulkDraft,
			effort,
		});
	};

	return (
		<div>
			<div className="ff15-label mb-1.5 text-[10px] tracking-[0.18em]">
				Model Presets
			</div>
			<div className="flex items-end gap-1.5">
				<div className="min-w-0 flex-1">
					<Select
						disabled={!bulkSelectionEnabled}
						onValueChange={handleBulkModelChange}
						value={bulkDraft?.modelId}
					>
						<SelectTrigger
							className={cn(
								"h-8 w-full min-w-0 px-2 font-mono text-[10px] uppercase tracking-[0.18em]",
								"hover:bg-black/60",
								"disabled:text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.58))]",
								"data-[placeholder]:text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.82))]",
								"[&_svg]:text-[color:var(--vscode-foreground)]"
							)}
							size="sm"
							style={{
								backgroundColor: "rgba(0, 0, 0, 0.5)",
								borderColor: "rgba(255, 255, 255, 0.12)",
								boxShadow: "none",
								color: "var(--vscode-foreground)",
							}}
						>
							<SelectValue placeholder="Select model" />
						</SelectTrigger>
						<SelectContent
							align="end"
							className="border-white/12 bg-[rgba(8,10,16,0.98)] text-[color:var(--vscode-foreground)]"
						>
							{modelCatalog.map((model) => (
								<SelectItem key={model.id} value={model.id}>
									{model.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="min-w-0 flex-1">
					<Select
						disabled={bulkEffortDisabled}
						onValueChange={handleBulkEffortChange}
						value={bulkDraft?.effort ?? undefined}
					>
						<SelectTrigger
							className={cn(
								"h-8 w-full min-w-0 px-2 font-mono text-[10px] uppercase tracking-[0.18em]",
								"hover:bg-black/60",
								"disabled:text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.58))]",
								"data-[placeholder]:text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.82))]",
								"[&_svg]:text-[color:var(--vscode-foreground)]"
							)}
							size="sm"
							style={{
								backgroundColor: "rgba(0, 0, 0, 0.5)",
								borderColor: "rgba(255, 255, 255, 0.12)",
								boxShadow: "none",
								color: "var(--vscode-foreground)",
							}}
						>
							<SelectValue placeholder="Effort unavailable" />
						</SelectTrigger>
						<SelectContent
							align="end"
							className="border-white/12 bg-[rgba(8,10,16,0.98)] text-[color:var(--vscode-foreground)]"
						>
							{bulkModel?.efforts.map((effort) => (
								<SelectItem key={effort.value} value={effort.value}>
									{effort.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<SidebarActionButton
					aria-label="Apply preset to party"
					className="h-8 w-8 shrink-0 px-0"
					disabled={applyDisabled}
					onClick={() => {
						if (!bulkDraft) {
							return;
						}

						onApplyBulkModel(bulkDraft);
					}}
					title="Apply preset to party"
				>
					<CheckIcon className="h-4 w-4" />
				</SidebarActionButton>
			</div>
			{bulkLiveApplyReason && !bulkLiveApplyEnabled ? (
				<div className="mt-2 text-[9px] text-[color:var(--vscode-errorForeground,#f87171)] leading-4">
					{bulkLiveApplyReason}
				</div>
			) : null}
		</div>
	);
};

export const PartyRosterPanel = ({
	bulkLiveApplyEnabled,
	bulkLiveApplyReason,
	bulkModelSelection,
	bulkModelSelectionSupported,
	modelCatalog,
	modelCatalogStatusMessage,
	modelSelectionDisabledReason,
	onApplyBulkModel,
	onChangeAgentModel,
	onChangeAgentVariant,
	onContinueAgent,
	partyRosterEnabled,
	partyRoster,
	provider,
}: PartyRosterPanelProps) => {
	const continueAction = provider?.capabilities.continueAgent ?? {
		enabled: partyRosterEnabled,
		supported: true,
		unavailableReason: partyRosterEnabled
			? null
			: "Launch Terminal before using party roster actions.",
	};
	const modelAction = provider?.capabilities.modelSelection ?? {
		enabled: modelSelectionDisabledReason === null,
		supported: true,
		unavailableReason: modelSelectionDisabledReason,
	};
	const showContinueReason =
		continueAction.unavailableReason !== null &&
		continueAction.unavailableReason !== modelAction.unavailableReason;

	return (
		<div className="ff15-panel px-3 py-2.5">
			<div className="mb-3 border-[color:var(--ff15-border-soft)] border-b pb-3">
				<BulkModelPresetPanel
					bulkLiveApplyEnabled={bulkLiveApplyEnabled}
					bulkLiveApplyReason={bulkLiveApplyReason}
					bulkModelSelection={bulkModelSelection}
					bulkModelSelectionSupported={bulkModelSelectionSupported}
					modelCatalog={modelCatalog}
					onApplyBulkModel={onApplyBulkModel}
				/>
			</div>
			<div className="mb-2 flex flex-wrap items-end justify-between gap-2">
				<div>
					<div className="ff15-label text-xs tracking-[0.18em]">
						Party Roster
					</div>
					{modelCatalogStatusMessage ? (
						<div className="mt-1 text-[9px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] leading-4">
							{modelCatalogStatusMessage}
						</div>
					) : null}
					{showContinueReason ? (
						<div className="mt-1 text-[9px] text-[color:var(--vscode-errorForeground,#f87171)] leading-4">
							{continueAction.unavailableReason}
						</div>
					) : null}
					{modelAction.unavailableReason ? (
						<div className="mt-1 text-[9px] text-[color:var(--vscode-errorForeground,#f87171)] leading-4">
							{modelAction.unavailableReason}
						</div>
					) : null}
				</div>
				<span className="rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_16%,transparent)] px-2 py-0.5 font-medium text-[9px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.12em]">
					{partyRoster.filter((agent) => agent.available).length} Live Panes
				</span>
			</div>
			<div className="grid gap-2">
				{partyRoster.map((agent) => {
					const theme = AGENT_THEMES[agent.agentId];
					const portraitFilter = [
						`drop-shadow(0 0 3px ${theme.glowSoft})`,
						`drop-shadow(0 0 7px ${theme.glow})`,
						agent.available
							? `drop-shadow(0 0 12px ${theme.accent})`
							: `drop-shadow(0 0 5px ${theme.glow})`,
					].join(" ");

					return (
						<ContextMenu key={agent.agentId}>
							<ContextMenuTrigger asChild>
								<div
									className={cn(
										"min-w-0",
										"rounded-xl",
										"border border-transparent",
										"px-3 py-2.5",
										"transition-transform",
										"hover:-translate-y-0.5",
										"shadow-[0_16px_34px_rgba(0,0,0,0.34)]"
									)}
									style={{
										background: theme.surface,
										boxShadow: `0 16px 34px rgba(0,0,0,0.34), 0 1px 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(255,255,255,0.03) inset, 0 0 18px ${theme.glow}`,
									}}
								>
									<div className="flex min-w-0 items-center gap-3.5">
										<div className="relative flex h-16 w-10 shrink-0 items-end justify-center">
											<span
												aria-hidden="true"
												className="pointer-events-none absolute rounded-full"
												style={{
													background: `radial-gradient(circle, ${agent.available ? theme.glowSoft : theme.glow} 0%, ${theme.glow} 62%, rgba(0,0,0,0) 100%)`,
													bottom: 0,
													height: "2rem",
													left: "50%",
													opacity: agent.available ? 1 : 0.72,
													transform: "translateX(-50%)",
													width: "2rem",
												}}
											/>
											{agent.available ? (
												<span
													aria-hidden="true"
													className="pointer-events-none absolute inset-x-1 bottom-1 h-8 rounded-full"
													style={{
														background: theme.glow,
														filter: "blur(16px)",
													}}
												/>
											) : null}
											<img
												alt={agent.displayName}
												className="relative z-10 h-full w-full object-contain object-bottom"
												height={64}
												src={AGENT_PORTRAITS[agent.agentId]}
												style={{ filter: portraitFilter }}
												width={40}
											/>
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<div
													className="truncate font-bold text-sm uppercase tracking-wider"
													style={{ color: theme.text }}
												>
													{agent.displayName}
												</div>
												<div
													className="font-mono text-[9px]"
													style={{
														color:
															"var(--vscode-descriptionForeground, rgba(255,255,255,0.76))",
														letterSpacing: "0.12em",
														textTransform: "uppercase",
													}}
												>
													{AGENT_ROLE_LABELS[agent.agentId]}
												</div>
											</div>
											<div className="mt-1 w-full">
												<AgentModelPicker
													agent={agent}
													disabled={false}
													modelCatalog={modelCatalog}
													modelSelectionDisabledReason={
														modelAction.unavailableReason
													}
													modelSelectionEnabled={modelAction.enabled}
													modelSelectionSupported={modelAction.supported}
													onChangeAgentModel={onChangeAgentModel}
													onChangeAgentVariant={onChangeAgentVariant}
												/>
											</div>
										</div>
									</div>
								</div>
							</ContextMenuTrigger>
							<ContextMenuContent className="w-52">
								<ContextMenuLabel>{agent.displayName}</ContextMenuLabel>
								<ContextMenuSeparator />
								<ContextMenuItem
									disabled={!continueAction.enabled}
									onSelect={() => {
										onContinueAgent(agent.agentId);
									}}
								>
									Continue
								</ContextMenuItem>
							</ContextMenuContent>
						</ContextMenu>
					);
				})}
			</div>
		</div>
	);
};
